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

    List<String> invokedToolNames() {
        return invoked;
    }

    PendingBooking pendingBooking() {
        return pendingBooking;
    }
}
