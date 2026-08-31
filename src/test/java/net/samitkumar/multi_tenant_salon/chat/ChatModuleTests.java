package net.samitkumar.multi_tenant_salon.chat;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.ai.chat.messages.AssistantMessage;
import org.springframework.ai.chat.messages.ToolResponseMessage;
import org.springframework.ai.chat.model.ChatModel;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.chat.model.Generation;
import org.springframework.ai.chat.prompt.ChatOptions;
import org.springframework.ai.chat.prompt.Prompt;
import org.springframework.ai.model.tool.ToolCallingChatOptions;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Primary;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;
import reactor.core.publisher.Flux;

import java.util.List;
import java.util.UUID;

@ApplicationModuleTest
@Import({TestcontainersConfiguration.class, ChatModuleTests.FakeChatModelConfig.class})
class ChatModuleTests {

    @Autowired
    WebApplicationContext context;

    private RestTestClient client() {
        return RestTestClient.bindToApplicationContext(context).build();
    }

    @Test
    void chatEndpointReturnsAssistantReplyAndInlineSuggestedQuestionsWithoutCallingRealAnthropicApi() {
        var salonId = UUID.randomUUID().toString();

        client().post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "sessionId": "s-1", "context": "website", "message": "What are your opening hours?" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.message").isEqualTo("This is a fixed test reply.")
                .jsonPath("$.sessionId").isEqualTo("s-1")
                .jsonPath("$.suggestedQuestions.length()").isEqualTo(3)
                .jsonPath("$.suggestedQuestions[0]").isEqualTo("How much is a haircut?");
    }

    @Test
    void chatEndpointMintsASessionIdWhenNoneIsSupplied() {
        var salonId = UUID.randomUUID().toString();

        client().post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "context": "website", "message": "hi" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.sessionId").isNotEmpty();
    }

    @Test
    void chatEndpointRemembersEarlierTurnsForTheSameSession() {
        var salonId = UUID.randomUUID().toString();

        client().post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "sessionId": "mem-1", "context": "website", "message": "MEMORY_PROBE_ALPHA is my code" }
                        """)
                .exchange()
                .expectStatus().isOk();

        client().post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "sessionId": "mem-1", "context": "website", "message": "what did I say before?" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.message").isEqualTo("I recall MEMORY_PROBE_ALPHA");
    }

    @Test
    void chatEndpointReturnsStagedPendingBookingWhenModelCallsProposeBookingTool() {
        var salonId = UUID.randomUUID().toString();

        client().post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "sessionId": "b-1", "context": "booking", "message": "TRIGGER_BOOKING_PROPOSAL please book it" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.pendingBooking.serviceId").isEqualTo(1)
                .jsonPath("$.pendingBooking.staffId").isEqualTo(2)
                .jsonPath("$.pendingBooking.appointmentDate").isEqualTo("2026-09-01")
                .jsonPath("$.pendingBooking.startTime").isEqualTo("10:00")
                .jsonPath("$.pendingBooking.customerName").isEqualTo("Jane Doe")
                .jsonPath("$.pendingBooking.customerEmail").isEqualTo("jane@example.com")
                .jsonPath("$.toolsUsed[0]").isEqualTo("booking-proposal");
    }

    @Test
    void chatEndpointReturnsUiComponentWhenModelCallsAShowTool() {
        var salonId = UUID.randomUUID().toString();

        client().post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "sessionId": "u-1", "context": "website", "message": "TRIGGER_SHOW_SERVICES what do you offer?" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.components.length()").isEqualTo(1)
                .jsonPath("$.components[0].type").isEqualTo("services");
    }

    @Test
    void chatEndpointReturnsSeveralComponentsWhenModelCallsSeveralRenderTools() {
        var salonId = UUID.randomUUID().toString();

        client().post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "sessionId": "m-1", "context": "website", "message": "TRIGGER_MULTI show me and ask" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.components.length()").isEqualTo(2)
                .jsonPath("$.components[0].type").isEqualTo("services")
                .jsonPath("$.components[1].type").isEqualTo("button-group");
    }

    @Test
    void chatEndpointRendersAFormWhenModelCallsShowForm() {
        var salonId = UUID.randomUUID().toString();

        client().post()
                .uri("/api/salon/{salonId}/chat", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "sessionId": "f-1", "context": "website", "message": "TRIGGER_SHOW_FORM take my details" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.components[0].type").isEqualTo("form")
                .jsonPath("$.components[0].props.title").isEqualTo("Your details");
    }

    @Test
    void chatFollowupsEndpointReturnsRelatedQuestionsFromTheUiStateOverride() {
        var salonId = UUID.randomUUID().toString();

        client().post()
                .uri("/api/salon/{salonId}/chat/followups", salonId)
                .contentType(org.springframework.http.MediaType.APPLICATION_JSON)
                .body("""
                        { "sessionId": "fu-1", "context": "website",
                          "uiState": "[Showed the visitor an interactive services card: Haircut, Colour]" }
                        """)
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$.followups.length()").isEqualTo(3)
                .jsonPath("$.followups[0]").isEqualTo("How much is a haircut?");
    }

    @TestConfiguration
    static class FakeChatModelConfig {

        private static final String PROPOSE_BOOKING_ARGUMENTS = """
                {"serviceId":1,"staffId":2,"appointmentDate":"2026-09-01","startTime":"10:00",\
                "customerName":"Jane Doe","customerEmail":"jane@example.com","customerPhone":null,"notes":null}""";

        private static final String SHOW_FORM_ARGUMENTS = """
                {"title":"Your details","fields":[{"name":"nm","label":"Name","type":"text","required":true,"pattern":null}],\
                "submitLabel":"Send"}""";

        private static final String BUTTON_GROUP_ARGUMENTS = """
                {"prompt":"Book now?","choices":[{"label":"Yes please","value":"yes please"}]}""";

        @Bean
        @Primary
        ChatModel fakeChatModel() {
            return new ChatModel() {
                @Override
                public ChatOptions getOptions() {
                    // Tool-calling only loops via ToolCallingAdvisor when the request's options
                    // are a ToolCallingChatOptions — a real model's options satisfy this; this
                    // fake must too, or tool calls the fake returns are never executed.
                    return ToolCallingChatOptions.builder().build();
                }

                @Override
                public ChatResponse call(Prompt prompt) {
                    // The follow-up generator is the only caller whose system prompt says "ask
                    // NEXT" — check it first so a transcript that also contains a TRIGGER_* word
                    // doesn't route the tool-less follow-up call down a tool branch.
                    if (instructionsContain(prompt, "ask NEXT")) {
                        return text("[\"How much is a haircut?\", \"Who does colour?\", \"Can I book one?\"]");
                    }

                    boolean toolResultPresent = prompt.getInstructions().stream()
                            .anyMatch(m -> m instanceof ToolResponseMessage);
                    if (toolResultPresent) {
                        return text("Done — anything else I can help with?");
                    }

                    if (instructionsContain(prompt, "what did I say before?")
                            && instructionsContain(prompt, "MEMORY_PROBE_ALPHA")) {
                        return text("I recall MEMORY_PROBE_ALPHA");
                    }
                    if (instructionsContain(prompt, "TRIGGER_BOOKING_PROPOSAL")) {
                        return toolCalls(new AssistantMessage.ToolCall("call-1", "function", "proposeBooking", PROPOSE_BOOKING_ARGUMENTS));
                    }
                    if (instructionsContain(prompt, "TRIGGER_MULTI")) {
                        return toolCalls(
                                new AssistantMessage.ToolCall("call-2", "function", "showServices", "{}"),
                                new AssistantMessage.ToolCall("call-3", "function", "showButtonGroup", BUTTON_GROUP_ARGUMENTS));
                    }
                    if (instructionsContain(prompt, "TRIGGER_SHOW_SERVICES")) {
                        return toolCalls(new AssistantMessage.ToolCall("call-4", "function", "showServices", "{}"));
                    }
                    if (instructionsContain(prompt, "TRIGGER_SHOW_FORM")) {
                        return toolCalls(new AssistantMessage.ToolCall("call-5", "function", "showForm", SHOW_FORM_ARGUMENTS));
                    }
                    return text("This is a fixed test reply.");
                }

                @Override
                public Flux<ChatResponse> stream(Prompt prompt) {
                    return Flux.just(call(prompt));
                }
            };
        }

        private static boolean instructionsContain(Prompt prompt, String needle) {
            return prompt.getInstructions().stream()
                    .anyMatch(m -> m.getText() != null && m.getText().contains(needle));
        }

        private static ChatResponse text(String content) {
            return new ChatResponse(List.of(new Generation(new AssistantMessage(content))));
        }

        private static ChatResponse toolCalls(AssistantMessage.ToolCall... calls) {
            var assistantMessage = AssistantMessage.builder().content("").toolCalls(List.of(calls)).build();
            return new ChatResponse(List.of(new Generation(assistantMessage)));
        }
    }
}
