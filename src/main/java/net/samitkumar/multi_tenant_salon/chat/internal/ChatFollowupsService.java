package net.samitkumar.multi_tenant_salon.chat.internal;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.memory.ChatMemory;
import org.springframework.ai.chat.messages.Message;
import org.springframework.ai.chat.messages.MessageType;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

/**
 * Suggests the questions a visitor is likely to want to ask <em>next</em>, given the salon's
 * data and the conversation so far. Reads the conversation from the shared {@link ChatMemory}
 * (keyed by {@code salonId:sessionId}) rather than a client-sent history array. Called both
 * inline by {@link ChatAssistantService} after each reply and directly via
 * {@code POST /chat/followups} when the frontend renders something without a round-trip (an
 * instant sidebar card, or a booking-picker step change). Returns an empty list on any failure
 * so the frontend can fall back to its static suggestion chips.
 */
@Service
@Slf4j
class ChatFollowupsService {

    private static final String SYSTEM_PROMPT = """
            You suggest what a visitor chatting with this salon's assistant is likely to want to
            ask NEXT. Produce 2 to 4 very short follow-up questions, phrased in the first person
            as the visitor would type them, at most 8 words each, plain text, no numbering or
            surrounding quotes.

            Base them ENTIRELY on the LATEST MESSAGE in the conversation (the assistant's most
            recent reply or the card it just showed) — go one step deeper into that, or to its
            natural next step (e.g. right after the services were shown: ask a price, ask who
            performs one, or start a booking; right after a staff member was named: ask what
            they do or book with them). The earlier turns are context only. Don't repeat a
            question already asked.

            Every follow-up MUST be consistent with what the LATEST MESSAGE just said — never
            suggest one that assumes something it just ruled out: a day or time the salon said
            it is closed, a service it said it does not offer, a stylist it said is unavailable.
            When the latest message says the salon is CLOSED on the day the visitor asked about
            (a holiday or one-off closure), do NOT offer that same day again. Pivot to the next
            day the salon is actually open: use TODAY'S DATE plus the salon's opening hours and
            HOLIDAYS / CLOSURES to work out that date, then phrase the follow-ups around it —
            name the concrete date ("What's open on Wed 3 Sep?"), ask to see that day's
            available times, or ask which stylists work then. Prefer a concrete date over a
            vague "another day".

            The LATEST MESSAGE is one of two things, and the follow-ups are grounded
            differently for each:

            1. It contains a bracketed [ ... ] description of an interactive element on the
               visitor's screen — a services list, a team list, an opening-hours / location /
               contact card, a date or time picker, the booking picker, a form, or a set of
               choices. Then the follow-ups MUST be about what THAT element is showing or asking
               RIGHT NOW — the specific people, services, hours or options it lists, or how to
               act on its current step — and MUST NOT jump to a later step or an unrelated
               topic. Always obey any "Base the follow-ups on ..." hint written inside the
               [ ... ] text. Examples:
                 - services card listing services -> "How much is <a listed service>?",
                   "How long does <service> take?", "Who does <service>?", "Book <service>"
                 - team card listing stylists     -> "Tell me about <a listed stylist>",
                   "What does <stylist> specialise in?", "Book with <stylist>"
                 - opening-hours card             -> "Are you open <day>?",
                   "What are <day>'s hours?", "Any closures coming up?"
                 - booking picker on the stylist step -> "Which stylist suits <service>?",
                   "What does <stylist> do?"  (NOT dates or times while that step is open)

            2. It is plain assistant prose with no [ ... ] element. Then base the follow-ups on
               that answer itself — go one step deeper into what it said, or to its natural
               next step.

            Stay strictly within what the assistant can answer: this salon's services and
            pricing, staff, opening hours, location, contact details, and holidays/closures —
            plus making a booking, but ONLY if "BOOKING" is in the salon's features list. Never
            suggest questions about memberships, an online shop, loyalty or rewards, analytics,
            or anything else, even when such a feature is enabled.

            Return ONLY a JSON array of strings, nothing else.
            """;

    private static final int MAX_FOLLOWUPS = 4;
    private static final int MAX_LEN = 80;

    private final ChatClient chatClient;
    private final SalonApiClient salonApiClient;
    private final ChatMemory chatMemory;
    private final ObjectMapper objectMapper = new ObjectMapper();

    ChatFollowupsService(ChatClient.Builder chatClientBuilder, SalonApiClient salonApiClient, ChatMemory chatMemory) {
        this.chatClient = chatClientBuilder.build();
        this.salonApiClient = salonApiClient;
        this.chatMemory = chatMemory;
    }

    /**
     * @param latestOverride when non-blank, treated as the LATEST MESSAGE (a bracketed UI-state
     *                       clue the frontend built, or the reply-plus-component description from
     *                       {@link ChatAssistantService}); otherwise the last turn in memory is
     *                       used.
     */
    List<String> followups(String salonId, String conversationId, String latestOverride) {
        try {
            var turns = new ArrayList<String>();
            for (Message m : chatMemory.get(conversationId)) {
                var rendered = render(m);
                if (rendered != null) {
                    turns.add(rendered);
                }
            }
            if (latestOverride != null && !latestOverride.isBlank()) {
                turns.add("Assistant: " + latestOverride.strip());
            }
            if (turns.isEmpty()) {
                return List.of();
            }

            var latest = turns.get(turns.size() - 1);
            var earlier = String.join("\n", turns.subList(0, turns.size() - 1));

            var user = salonData(salonId)
                    + "\n\nTODAY'S DATE is " + LocalDate.now() + " (yyyy-MM-dd) — resolve relative"
                    + " dates against it and use it to name a concrete next open date when needed."
                    + "\n\nEARLIER TURNS (context only):\n" + (earlier.isBlank() ? "(none)" : earlier)
                    + "\n\nLATEST MESSAGE (base the follow-ups on THIS):\n" + latest;

            String content = chatClient.prompt()
                    .system(SYSTEM_PROMPT)
                    .user(user)
                    .call()
                    .content();

            return parse(content);
        } catch (Exception e) {
            log.warn("Follow-up suggestion generation failed for salon {}: {}", salonId, e.getMessage());
            return List.of();
        }
    }

    /** Renders one memory message as a transcript line; {@code null} for system / tool turns. */
    private static String render(Message m) {
        if (m.getText() == null || m.getText().isBlank()) {
            return null;
        }
        if (m.getMessageType() == MessageType.USER) {
            return "Visitor: " + m.getText();
        }
        if (m.getMessageType() == MessageType.ASSISTANT) {
            return "Assistant: " + m.getText();
        }
        return null;
    }

    private String salonData(String salonId) {
        return """
                SALON PROFILE (note the "features" array — it lists which capabilities, e.g.
                BOOKING, are enabled for this salon):
                %s

                STAFF:
                %s

                SERVICES:
                %s

                HOLIDAYS / CLOSURES:
                %s
                """.formatted(
                safe(() -> salonApiClient.getSalon(salonId)),
                safe(() -> salonApiClient.getStaff(salonId)),
                safe(() -> salonApiClient.getServices(salonId)),
                safe(() -> salonApiClient.getHolidays(salonId)));
    }

    private List<String> parse(String content) {
        if (content == null || content.isBlank()) return List.of();
        var cleaned = content.strip();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceAll("^```(?:json)?\\s*", "").replaceAll("\\s*```$", "").strip();
        }
        // The model is told to return ONLY a JSON array, but sometimes wraps it in a sentence
        // ("Sure, here are some follow-ups: [...]") — pull out just the array in that case.
        if (!cleaned.startsWith("[")) {
            var start = cleaned.indexOf('[');
            var end = cleaned.lastIndexOf(']');
            if (start >= 0 && end > start) {
                cleaned = cleaned.substring(start, end + 1);
            }
        }
        try {
            return objectMapper.<List<String>>readValue(cleaned, new TypeReference<List<String>>() {}).stream()
                    .filter(s -> s != null && !s.isBlank() && s.length() <= MAX_LEN)
                    .map(String::strip)
                    .distinct()
                    .limit(MAX_FOLLOWUPS)
                    .toList();
        } catch (Exception e) {
            log.warn("Could not parse follow-up questions from model output: {}", e.getMessage());
            return List.of();
        }
    }

    private static String safe(java.util.function.Supplier<String> call) {
        try {
            var v = call.get();
            return v == null ? "(unavailable)" : v;
        } catch (Exception e) {
            return "(unavailable)";
        }
    }
}
