package net.samitkumar.multi_tenant_salon.chat.internal;

import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;

import java.util.ArrayList;
import java.util.List;

/**
 * Tool set for one chat request, bound to a single {@code salonId} at construction time. The LLM
 * never supplies the salon id as a tool argument, so it can't be prompt-injected into fetching
 * another tenant's data.
 */
class SalonDataTools {

    private final SalonApiClient client;
    private final String salonId;
    private final List<String> invoked = new ArrayList<>();
    private PendingBooking pendingBooking;
    private UiDirective uiDirective;

    SalonDataTools(SalonApiClient client, String salonId) {
        this.client = client;
        this.salonId = salonId;
    }

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

    @Tool(description = "Check real available appointment slots for a service on a given date, optionally for one staff member. Always call this before proposing a booking — never guess a time. Date format: yyyy-MM-dd.")
    String checkAvailability(
            @ToolParam(description = "The service's id, from getServices") Long serviceId,
            @ToolParam(description = "Date to check, format yyyy-MM-dd") String date,
            @ToolParam(required = false, description = "Restrict to one staff member's id; omit to check all staff") Long staffId) {
        invoked.add("slots");
        return client.getSlots(salonId, serviceId, date, staffId);
    }

    @Tool(description = """
            Stage a booking proposal for the visitor to review and confirm themselves in the UI — \
            this does NOT create the booking. Only call this once: the exact serviceId/date/startTime \
            has been confirmed available via checkAvailability, and you know the visitor's name and at \
            least one of email or phone. After calling this, tell the visitor their booking details are \
            ready for them to confirm — do not ask them to reply "yes" in chat, confirmation happens via \
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
        return "Booking proposal staged — shown to the visitor to confirm in the interface.";
    }

    // ── Render tools ──────────────────────────────────────────────────────────
    // These don't fetch anything — they only record which interactive card the frontend should
    // render for this turn, so the assistant (not a brittle keyword heuristic on the frontend)
    // decides. Keep the written reply to a short lead-in when you call one; the card carries the
    // detail. They're deliberately not added to `invoked` — they aren't data lookups.

    @Tool(description = """
            Show the visitor an interactive services card (name, price, duration, grouped by \
            category) they can browse and tap "Book" on. Prefer this over listing services in \
            prose whenever they want to see what's offered or are choosing something to book. \
            Call getServices as well if you need the details to answer a specific question.""")
    String showServices(
            @ToolParam(required = false, description = "Show only services this staff member can perform; omit for all") Long forStaffId,
            @ToolParam(required = false, description = "true when the visitor is picking a service to book (frames the card as a booking start); omit when just browsing") Boolean forBooking) {
        this.uiDirective = new UiDirective("services", null, null, forStaffId, null, forBooking);
        return "Services card shown to the visitor.";
    }

    @Tool(description = "Show the visitor an interactive team card (photo, name, role). Prefer this over listing staff in prose when they ask about the team or who works there.")
    String showStaff(
            @ToolParam(required = false, description = "Show only staff who can perform this service; omit for all") Long forServiceId) {
        this.uiDirective = new UiDirective("staff", null, null, null, forServiceId, null);
        return "Team card shown to the visitor.";
    }

    @Tool(description = "Show the visitor the opening-hours card for the week. Prefer this over typing the hours out when they ask when the salon is open.")
    String showOpeningHours() {
        this.uiDirective = UiDirective.of("hours");
        return "Opening-hours card shown to the visitor.";
    }

    @Tool(description = "Show the visitor the location card (address + map link). Call this when they ask where the salon is or how to get there.")
    String showLocation() {
        this.uiDirective = UiDirective.of("location");
        return "Location card shown to the visitor.";
    }

    @Tool(description = "Show the visitor the contact card (phone, email, website). Call this when they ask how to get in touch.")
    String showContact() {
        this.uiDirective = UiDirective.of("contact");
        return "Contact card shown to the visitor.";
    }

    @Tool(description = """
            Open the interactive booking picker for a service — the visitor then chooses the \
            staff (if needed), date and time against real availability and enters their own \
            contact details, then confirms. This is the preferred way to take a booking: call it \
            as soon as you know the service (resolve the name to its id with getServices first) \
            and, if the visitor named a stylist, the staff id. Do NOT also call proposeBooking or \
            ask for the date/time/contact in chat — the picker handles all of that.""")
    String startBookingPicker(
            @ToolParam(description = "The service's id, from getServices") Long serviceId,
            @ToolParam(required = false, description = "Preferred staff member's id if the visitor named one; omit to let them choose") Long staffId) {
        this.uiDirective = new UiDirective("booking-picker", serviceId, staffId, null, null, null);
        return "Booking picker opened for the visitor to choose a time and confirm.";
    }

    List<String> invokedToolNames() {
        return invoked;
    }

    PendingBooking pendingBooking() {
        return pendingBooking;
    }

    UiDirective uiDirective() {
        return uiDirective;
    }
}
