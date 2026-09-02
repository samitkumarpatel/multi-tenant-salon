package net.samitkumar.multi_tenant_salon.chat.internal;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Tool set for one chat request, bound to a single {@code salonId} at construction time. The LLM
 * never supplies the salon id as a tool argument, so it can't be prompt-injected into fetching
 * another tenant's data.
 */
class SalonDataTools {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private final SalonApiClient client;
    private final String salonId;
    private final List<String> invoked = new ArrayList<>();
    private final List<UiComponent> components = new ArrayList<>();
    private PendingBooking pendingBooking;

    SalonDataTools(SalonApiClient client, String salonId) {
        this.client = client;
        this.salonId = salonId;
    }

    // ── Nested tool-argument shapes ──────────────────────────────────────────

    /** One field the model wants a {@code form} component to collect. */
    record FieldSpec(String name, String label, String type, Boolean required, String pattern) {}

    /** One selectable option in a button/radio/checkbox/option-list component. */
    record Choice(String label, String value) {}

    // ── Data lookup tools ───────────────────────────────────────────────────

    @Tool(description = "Get the salon's profile: name, location/address, contact info (phone/email), operating hours, and enabled features.")
    String getSalonProfile() {
        invoked.add("salon");
        return client.getSalon(salonId);
    }

    @Tool(description = "List the salon's staff members with their name, role, and specializations.")
    String getStaff() {
        invoked.add("staff");
        return client.getStaff(salonId);
    }

    @Tool(description = "List the salon's services with price, duration, and category.")
    String getServices() {
        invoked.add("services");
        return client.getServices(salonId);
    }

    @Tool(description = "List the salon's holidays and closures (dates the salon is not open).")
    String getHolidays() {
        invoked.add("holidays");
        return client.getHolidays(salonId);
    }

    @Tool(description = """
            Check real availability for a service on ONE date (optionally one staff member). Call \
            this before proposing a booking and for any "is the salon open / what times are free \
            on <date>" question. Never guess a time or a weekday. Returns JSON: `date`, `weekday` \
            (the real weekday — use it verbatim, don't recompute), `status` \
            (OPEN / SALON_CLOSED / STAFF_OFF / FULLY_BOOKED), `available`, `reason` (present \
            unless OPEN — names the holiday/closure or explains the block), `slots` (each with \
            `booked`), and `nextAvailable` (the soonest open slot within two weeks, or null). \
            Date format: yyyy-MM-dd.""")
    String checkAvailability(
            @ToolParam(description = "The service's id, from getServices") Long serviceId,
            @ToolParam(description = "Date to check, format yyyy-MM-dd") String date,
            @ToolParam(required = false, description = "Restrict to one staff member's id; omit to check all staff") Long staffId) {
        invoked.add("slots");

        final LocalDate day;
        try {
            day = LocalDate.parse(date);
        } catch (RuntimeException e) {
            return "{\"error\":\"'" + date + "' is not a valid yyyy-MM-dd date.\"}";
        }

        String raw = client.getAvailability(salonId, serviceId, staffId,
                date, day.plusDays(14).toString(), "SLOT", null);
        Map<String, Object> availability;
        try {
            availability = MAPPER.readValue(raw, new TypeReference<Map<String, Object>>() {});
        } catch (Exception e) {
            return raw; // hand the model whatever the endpoint said
        }

        Map<String, Object> asked = null;
        Object daysObj = availability.get("days");
        if (daysObj instanceof List<?> list) {
            for (Object o : list) {
                if (o instanceof Map<?, ?> m && date.equals(String.valueOf(m.get("date")))) {
                    //noinspection unchecked
                    asked = (Map<String, Object>) m;
                    break;
                }
            }
        }
        if (asked == null) {
            return raw;
        }

        var out = new LinkedHashMap<String, Object>();
        out.put("date", asked.get("date"));
        out.put("weekday", asked.get("weekday"));
        out.put("status", asked.get("status"));
        out.put("available", "OPEN".equals(asked.get("status")));
        if (asked.get("reason") != null) {
            out.put("reason", asked.get("reason"));
        }
        out.put("openSlotCount", asked.getOrDefault("openSlotCount", 0));
        if (asked.get("slots") != null) {
            out.put("slots", asked.get("slots"));
        }
        out.put("nextAvailable", availability.get("firstAvailable"));
        try {
            return MAPPER.writeValueAsString(out);
        } catch (Exception e) {
            return raw;
        }
    }

    @Tool(description = """
            Find which DAYS have availability across a date range — use for "what days can I come \
            in", "when is <stylist> next free", "any openings next week", or before showing a \
            date picker. Returns JSON `days` (each: `date`, `weekday`, `status`, `reason`, \
            `openSlotCount`, `availableStaffIds`) and `firstAvailable`. With `limit` set, `days` \
            lists only that many OPEN days. Use `weekday`/`reason` from the result verbatim.""")
    String findAvailableDates(
            @ToolParam(required = false, description = "Service id, from getServices — sizes the slots") Long serviceId,
            @ToolParam(required = false, description = "Restrict to one staff member's id") Long staffId,
            @ToolParam(required = false, description = "Range start, yyyy-MM-dd; omit for today") String from,
            @ToolParam(required = false, description = "Range end, yyyy-MM-dd; omit for the salon's booking window") String to,
            @ToolParam(required = false, description = "Return only the first N OPEN days") Integer limit) {
        invoked.add("slots");
        return client.getAvailability(salonId, serviceId, staffId, from, to, "DAY", limit);
    }

    @Tool(description = """
            Stage a booking proposal for the visitor to review and confirm themselves in the UI - \
            this does NOT create the booking. Only call this once: the exact serviceId/date/startTime \
            has been confirmed available via checkAvailability, and you know the visitor's name and at \
            least one of email or phone. After calling this, tell the visitor their booking details are \
            ready for them to confirm - do not ask them to reply "yes" in chat, confirmation happens via \
            a button in the interface.""")
    String proposeBooking(
            @ToolParam(description = "The service's id, from getServices") Long serviceId,
            @ToolParam(required = false, description = "Preferred staff member's id; omit to let any available staff member take it") Long staffId,
            @ToolParam(description = "Date, format yyyy-MM-dd") String appointmentDate,
            @ToolParam(description = "Start time, format HH:mm, from a real checkAvailability result") String startTime,
            @ToolParam(description = "Visitor's full name") String customerName,
            @ToolParam(required = false, description = "Visitor's email; required if phone is not given") String customerEmail,
            @ToolParam(required = false, description = "Visitor's phone; required if email is not given") String customerPhone,
            @ToolParam(required = false, description = "Any notes for the salon") String notes) {
        invoked.add("booking-proposal");
        this.pendingBooking = new PendingBooking(serviceId, staffId, appointmentDate, startTime,
                customerName, customerEmail, customerPhone, notes);
        return "Booking proposal staged - shown to the visitor to confirm in the interface.";
    }

    // ── Render tools ──────────────────────────────────────────────────────────
    // These don't fetch anything - they only record which interactive component(s) the frontend
    // should render for this turn, so the assistant (not a brittle keyword heuristic) decides.
    // A turn can accumulate several. Keep the written reply to a short lead-in when you call one;
    // the component carries the detail. They're deliberately not added to `invoked` - they aren't
    // data lookups. Every `props` value here is UI scaffolding only (ids, flags, labels) - never
    // salon data; the React component fetches its own live data.

    @Tool(description = """
            Show the visitor an interactive services card (name, price, duration, grouped by \
            category) they can browse and tap "Book" on. Prefer this over listing services in \
            prose whenever they want to see what's offered or are choosing something to book. \
            Call getServices as well if you need the details to answer a specific question.""")
    String showServices(
            @ToolParam(required = false, description = "Show only services this staff member can perform; omit for all") Long forStaffId,
            @ToolParam(required = false, description = "true when the visitor is picking a service to book (frames the card as a booking start); omit when just browsing") Boolean forBooking) {
        components.add(new UiComponent("services", props("forStaffId", forStaffId, "forBooking", forBooking)));
        return "Services card shown to the visitor.";
    }

    @Tool(description = "Show the visitor an interactive team card (photo, name, role). Prefer this over listing staff in prose when they ask about the team or who works there.")
    String showStaff(
            @ToolParam(required = false, description = "Show only staff who can perform this service; omit for all") Long forServiceId) {
        components.add(new UiComponent("staff", props("forServiceId", forServiceId)));
        return "Team card shown to the visitor.";
    }

    @Tool(description = """
            Show the visitor a single staff member's profile card: their bio/about-me text and \
            their work portfolio of photos and videos, which the visitor can tap to view \
            full-screen, plus a Book button. Prefer this over showStaff (the whole-team list) and \
            over describing them in prose whenever the visitor asks about one specific staff \
            member - their background, "about", or examples of their work. Resolve the staffId \
            via getStaff first.""")
    String showStaffProfile(
            @ToolParam(description = "The staff member's id, from getStaff") Long staffId) {
        components.add(new UiComponent("staff-profile", props("staffId", staffId)));
        return "Staff profile card shown to the visitor.";
    }

    @Tool(description = "Show the visitor the opening-hours card for the week. Prefer this over typing the hours out when they ask when the salon is open.")
    String showOpeningHours() {
        components.add(UiComponent.of("hours"));
        return "Opening-hours card shown to the visitor.";
    }

    @Tool(description = "Show the visitor the location card (address + map link). Call this when they ask where the salon is or how to get there.")
    String showLocation() {
        components.add(UiComponent.of("location"));
        return "Location card shown to the visitor.";
    }

    @Tool(description = "Show the visitor the contact card (phone, email, website). Call this when they ask how to get in touch.")
    String showContact() {
        components.add(UiComponent.of("contact"));
        return "Contact card shown to the visitor.";
    }

    @Tool(description = """
            Show the visitor a menu of tappable quick-question options (book, services, staff, \
            hours, location, contact - whichever this salon actually has). Call this after \
            declining an off-topic message when nothing else is already in progress, so the \
            visitor has an easy way back in instead of a dead end. Don't call this if a \
            bracketed clue shows a booking or card already in progress - reference that instead.""")
    String showQuickActions() {
        components.add(UiComponent.of("quick-actions"));
        return "Quick-questions menu shown to the visitor.";
    }

    @Tool(description = """
            Open the interactive booking picker for a service - the visitor then chooses the \
            staff (if needed), date and time against real availability and enters their own \
            contact details, then confirms. This is the preferred way to take a booking: call it \
            as soon as you know the service (resolve the name to its id with getServices first) \
            and, if the visitor named a stylist, the staff id. If the visitor named a day \
            ("next Sunday", "the 14th", "tomorrow"), resolve it to yyyy-MM-dd against today's \
            date and pass it as `date` so the picker opens on that day. Do NOT also call \
            proposeBooking or ask for the date/time/contact in chat - the picker handles all of that.""")
    String startBookingPicker(
            @ToolParam(description = "The service's id, from getServices") Long serviceId,
            @ToolParam(required = false, description = "Preferred staff member's id if the visitor named one; omit to let them choose") Long staffId,
            @ToolParam(required = false, description = "The day the visitor asked for, resolved to yyyy-MM-dd against today; the picker opens on this date. Omit if they didn't name a day.") String date) {
        components.add(new UiComponent("booking-picker",
                props("serviceId", serviceId, "staffId", staffId, "date", upcomingDateOrNull(date))));
        return "Booking picker opened for the visitor to choose a time and confirm.";
    }

    @Tool(description = """
            Show a lightweight date picker so the visitor can see which days work against the \
            salon's real availability - use this when they're asking about days (e.g. "what days \
            is Nat free next week?") but haven't committed to booking yet. For the full guided \
            booking flow (staff -> date -> time -> contact -> confirm) use startBookingPicker \
            instead. If the visitor named a day, resolve it to yyyy-MM-dd against today's date \
            and pass it as `date` so the calendar opens on that day.""")
    String showDatePicker(
            @ToolParam(required = false, description = "Service the visitor is interested in, from getServices - narrows availability") Long serviceId,
            @ToolParam(required = false, description = "Staff member the visitor named, from getStaff") Long staffId,
            @ToolParam(required = false, description = "The day the visitor asked for, resolved to yyyy-MM-dd against today; the calendar opens on this date. Omit if they didn't name a day.") String date) {
        components.add(new UiComponent("date-picker",
                props("serviceId", serviceId, "staffId", staffId, "date", upcomingDateOrNull(date))));
        return "Date picker shown to the visitor.";
    }

    @Tool(description = """
            Show real bookable time slots for a service on a specific date (optionally for one \
            staff member). The card fetches live availability itself, so you don't need to call \
            checkAvailability first unless you want to mention specific times in your written \
            reply. Date format yyyy-MM-dd.""")
    String showTimeSlots(
            @ToolParam(description = "Service id, from getServices") Long serviceId,
            @ToolParam(description = "Date, yyyy-MM-dd") String date,
            @ToolParam(required = false, description = "Restrict to one staff member's id") Long staffId) {
        components.add(new UiComponent("time-slot-picker", props("serviceId", serviceId, "date", date, "staffId", staffId)));
        return "Time-slot card shown to the visitor.";
    }

    @Tool(description = """
            Show a short form to collect details from the visitor (e.g. their name and a phone or \
            email) only when you genuinely need information you can't get any other way. Do NOT \
            use this for booking - startBookingPicker already collects the visitor's contact \
            details. Field `type` is one of: text, email, tel, textarea.""")
    String showForm(
            @ToolParam(description = "Heading shown above the form") String title,
            @ToolParam(description = "The fields to collect") List<FieldSpec> fields,
            @ToolParam(required = false, description = "Label for the submit button; defaults to \"Send\"") String submitLabel) {
        components.add(new UiComponent("form", props("title", title, "fields", fields, "submitLabel", submitLabel)));
        return "Form shown to the visitor.";
    }

    @Tool(description = """
            Show a row of buttons for a yes/no or either/or choice. `label` is what the visitor \
            sees on the button; `value` is the exact message sent back as their reply when they \
            tap it - phrase it as something the visitor would say.""")
    String showButtonGroup(
            @ToolParam(description = "The question shown above the buttons") String prompt,
            @ToolParam(description = "The buttons") List<Choice> choices) {
        components.add(new UiComponent("button-group", props("prompt", prompt, "choices", choices)));
        return "Buttons shown to the visitor.";
    }

    @Tool(description = "Show a single-select list of radio options for an either/or style question. `value` is the message sent back when the visitor picks that option and continues.")
    String showRadioGroup(
            @ToolParam(description = "The question shown above the options") String prompt,
            @ToolParam(description = "The options") List<Choice> choices) {
        components.add(new UiComponent("radio-group", props("prompt", prompt, "choices", choices)));
        return "Options shown to the visitor.";
    }

    @Tool(description = "Show a multi-select checklist when the visitor may pick several of the options. The chosen `value`s are sent back joined together as their reply.")
    String showCheckboxGroup(
            @ToolParam(description = "The question shown above the checklist") String prompt,
            @ToolParam(description = "The options") List<Choice> choices) {
        components.add(new UiComponent("checkbox-group", props("prompt", prompt, "choices", choices)));
        return "Checklist shown to the visitor.";
    }

    @Tool(description = "Show a plain tappable list of options - like a menu - when you want the visitor to pick exactly one and continue. `value` is the message sent back when they tap one.")
    String showOptionList(
            @ToolParam(description = "The question or heading shown above the list") String prompt,
            @ToolParam(description = "The options") List<Choice> choices) {
        components.add(new UiComponent("option-list", props("prompt", prompt, "choices", choices)));
        return "Options shown to the visitor.";
    }

    // ── Accessors ────────────────────────────────────────────────────────────

    List<String> invokedToolNames() {
        return invoked;
    }

    PendingBooking pendingBooking() {
        return pendingBooking;
    }

    List<UiComponent> components() {
        return List.copyOf(components);
    }

    /**
     * The model resolves a relative phrase ("next Sunday") to a yyyy-MM-dd itself; keep that date
     * only if it parses and isn't in the past. A bad or stale value is dropped so the picker just
     * falls back to its own default (first bookable day) rather than opening on nonsense.
     */
    private static String upcomingDateOrNull(String date) {
        if (date == null || date.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(date).isBefore(LocalDate.now()) ? null : date;
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** {@code Map.of} rejects null values; render-tool props routinely have optional (null) args. */
    private static Map<String, Object> props(Object... kv) {
        var m = new LinkedHashMap<String, Object>();
        for (int i = 0; i < kv.length; i += 2) {
            if (kv[i + 1] != null) {
                m.put((String) kv[i], kv[i + 1]);
            }
        }
        return m;
    }
}
