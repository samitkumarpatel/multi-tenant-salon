package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingRescheduledEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffBookingAssignedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonDisabledEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonUpdatedEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;

/**
 * The single entry point through which every kind of SalonSaaS email notification is composed and
 * dispatched. Domain modules never call this directly (that would violate module boundaries) —
 * instead they publish domain events, and the listeners in this module translate those events into
 * calls against the methods below. Keeping every template and the one Mailjet dispatch call here
 * means there is exactly one place that knows how to send an email.
 */
@Service
@Slf4j
class NotificationService {

    private static final DateTimeFormatter DATE_FMT = DateTimeFormatter.ofPattern("EEE, d MMM yyyy", Locale.ENGLISH);
    private static final DateTimeFormatter TIME_FMT = DateTimeFormatter.ofPattern("h:mm a", Locale.ENGLISH);

    private final MailjetClient mailjetClient;

    @Value("${spring.application.notification.mailjet.sender:noreply@salonsaas.org}")
    private String sender;
    @Value("${spring.application.notification.mailjet.sender-name:SalonSaaS}")
    private String senderName;
    @Value("${spring.application.notification.mailjet.api-key:}")
    private String apiKey;
    @Value("${spring.application.notification.salon-domain:salonsaas.org}")
    private String salonDomain;
    @Value("${spring.application.notification.admin-app-url:https://admin.salonsaas.org}")
    private String adminAppUrl;
    @Value("${spring.application.notification.staff-app-url:https://staff.salonsaas.org}")
    private String staffAppUrl;

    NotificationService(MailjetClient mailjetClient) {
        this.mailjetClient = mailjetClient;
    }

    // ── Salon lifecycle ──────────────────────────────────────────────────────

    void notifySalonOnboarded(SalonCreatedEvent event) {
        var manageLink = adminSalonUrl(event.salonId());
        var websiteLink = websiteUrl(event.salonHandler());
        var features = event.features().isEmpty() ? "none yet — you can enable them anytime"
                : event.features().stream().map(Object::toString).toList().toString();

        var subject = "Welcome to SalonSaaS! \"" + event.salonName() + "\" is live";
        var text = """
                Hi %s,

                Welcome to SalonSaaS! Your salon "%s" has been created successfully.

                Manage your salon: %s
                Your public website: %s
                Enabled features: %s

                If you have any questions, just reply to this email.

                — The SalonSaaS Team
                """.formatted(event.ownerName(), event.salonName(), manageLink, websiteLink, features);
        var html = """
                <p>Hi %s,</p>
                <p>Welcome to <strong>SalonSaaS</strong>! Your salon "<strong>%s</strong>" has been created successfully.</p>
                <p><a href="%s">Manage your salon</a></p>
                <p><a href="%s">Visit your public website</a></p>
                <p>Enabled features: %s</p>
                <p><small>If you have any questions, just reply to this email.</small></p>
                """.formatted(event.ownerName(), event.salonName(), manageLink, websiteLink, features);

        sendEmail(event.ownerEmail(), event.ownerName(), subject, text, html);
    }

    void notifySalonDisabled(SalonDisabledEvent event) {
        var subject = "Your salon \"" + event.salonName() + "\" has been disabled";
        var text = """
                Hi %s,

                Your salon "%s" has been disabled and is no longer visible to customers.

                If this wasn't expected, please contact support.

                — The SalonSaaS Team
                """.formatted(event.ownerName(), event.salonName());
        var html = """
                <p>Hi %s,</p>
                <p>Your salon "<strong>%s</strong>" has been disabled and is no longer visible to customers.</p>
                <p><small>If this wasn't expected, please contact support.</small></p>
                """.formatted(event.ownerName(), event.salonName());

        sendEmail(event.ownerEmail(), event.ownerName(), subject, text, html);
    }

    void notifySalonUpdated(SalonUpdatedEvent event) {
        var manageLink = adminSalonUrl(event.salonId());
        var subject = "Your salon \"" + event.salonName() + "\" settings were updated";
        var text = """
                Hi %s,

                Your salon "%s" settings were just updated.

                Review your salon: %s

                If this wasn't you, please contact support immediately.

                — The SalonSaaS Team
                """.formatted(event.ownerName(), event.salonName(), manageLink);
        var html = """
                <p>Hi %s,</p>
                <p>Your salon "<strong>%s</strong>" settings were just updated.</p>
                <p><a href="%s">Review your salon</a></p>
                <p><small>If this wasn't you, please contact support immediately.</small></p>
                """.formatted(event.ownerName(), event.salonName(), manageLink);

        sendEmail(event.ownerEmail(), event.ownerName(), subject, text, html);
    }

    // ── Bookings — customer-facing ───────────────────────────────────────────

    void notifyBookingCreated(BookingCreatedEvent event) {
        var subject = "Booking received — " + formattedDateTime(event);
        var text = """
                Hi %s,

                We've received your booking request (#%d) for %s at %s.

                We'll let you know as soon as it's confirmed.

                — The SalonSaaS Team
                """.formatted(event.customerName(), event.bookingId(), formattedDateTime(event), event.startTime().format(TIME_FMT));
        var html = """
                <p>Hi %s,</p>
                <p>We've received your booking request (#%d) for <strong>%s</strong>.</p>
                <p>We'll let you know as soon as it's confirmed.</p>
                """.formatted(event.customerName(), event.bookingId(), formattedDateTime(event));

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html);
    }

    void notifyBookingStatusChanged(BookingStatusChangedEvent event) {
        var message = switch (event.newStatus()) {
            case CONFIRMED -> "Your booking has been confirmed by the salon.";
            case CANCELLED -> "Your booking has been cancelled. We hope to see you another time.";
            case COMPLETED -> "Thank you for your visit! Your appointment is now marked complete.";
            case NO_SHOW -> "Your appointment was marked as no-show. Please contact the salon if this is incorrect.";
            default -> "Your booking status has been updated to " + event.newStatus() + ".";
        };
        var subject = "Booking update — " + event.newStatus();
        var text = """
                Hi %s,

                %s

                Booking #%d — %s at %s

                — The SalonSaaS Team
                """.formatted(event.customerName(), message, event.bookingId(),
                event.appointmentDate() != null ? event.appointmentDate().format(DATE_FMT) : "—",
                event.startTime() != null ? event.startTime().format(TIME_FMT) : "—");
        var html = """
                <p>Hi %s,</p>
                <p>%s</p>
                <p>Booking #%d — %s at %s</p>
                """.formatted(event.customerName(), message, event.bookingId(),
                event.appointmentDate() != null ? event.appointmentDate().format(DATE_FMT) : "—",
                event.startTime() != null ? event.startTime().format(TIME_FMT) : "—");

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html);
    }

    void notifyBookingRescheduled(BookingRescheduledEvent event) {
        var subject = "Your appointment has been rescheduled";
        var text = """
                Hi %s,

                Your booking #%d has been rescheduled to %s at %s.

                — The SalonSaaS Team
                """.formatted(event.customerName(), event.bookingId(),
                event.newAppointmentDate().format(DATE_FMT), event.newStartTime().format(TIME_FMT));
        var html = """
                <p>Hi %s,</p>
                <p>Your booking #%d has been rescheduled to <strong>%s at %s</strong>.</p>
                """.formatted(event.customerName(), event.bookingId(),
                event.newAppointmentDate().format(DATE_FMT), event.newStartTime().format(TIME_FMT));

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html);
    }

    // ── Bookings — staff-facing ──────────────────────────────────────────────

    void notifyStaffBookingAssigned(StaffBookingAssignedEvent event) {
        if (!StringUtils.hasText(event.staffEmail())) {
            log.info("[NOTIFICATION] Staff {} has no email on file — skipping booking-assigned notification for booking #{}",
                    event.staffId(), event.bookingId());
            return;
        }
        var subject = "New booking — " + event.appointmentDate().format(DATE_FMT) + " " + event.startTime().format(TIME_FMT);
        var text = """
                Hi %s,

                You've been booked for a new appointment.

                Booking #%d
                Customer : %s
                When     : %s at %s – %s

                View your schedule: %s

                — The SalonSaaS Team
                """.formatted(event.staffName(), event.bookingId(), event.customerName(),
                event.appointmentDate().format(DATE_FMT), event.startTime().format(TIME_FMT), event.endTime().format(TIME_FMT),
                staffAppUrl);
        var html = """
                <p>Hi %s,</p>
                <p>You've been booked for a new appointment.</p>
                <p>Booking #%d<br>Customer: %s<br>When: %s at %s – %s</p>
                <p><a href="%s">View your schedule</a></p>
                """.formatted(event.staffName(), event.bookingId(), event.customerName(),
                event.appointmentDate().format(DATE_FMT), event.startTime().format(TIME_FMT), event.endTime().format(TIME_FMT),
                staffAppUrl);

        sendEmail(event.staffEmail(), event.staffName(), subject, text, html);
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────

    private String adminSalonUrl(Object salonId) {
        return adminAppUrl + "/" + salonId;
    }

    private String websiteUrl(String handler) {
        return "https://" + handler + "." + salonDomain;
    }

    private String formattedDateTime(BookingCreatedEvent event) {
        return event.appointmentDate().format(DATE_FMT) + " " + event.startTime().format(TIME_FMT) + " – " + event.endTime().format(TIME_FMT);
    }

    /** The one place that actually talks to Mailjet. Never throws — a notification failure must not break the triggering business flow. */
    private void sendEmail(String toEmail, String toName, String subject, String textBody, String htmlBody) {
        if (!StringUtils.hasText(toEmail)) {
            log.warn("[NOTIFICATION] No recipient email — skipping send. subject='{}'", subject);
            return;
        }
        if (!StringUtils.hasText(apiKey)) {
            log.info("[NOTIFICATION] Mailjet not configured — skipping send. to={} <{}> subject='{}'", toName, toEmail, subject);
            return;
        }
        try {
            var request = new MailjetRequest(List.of(new MailjetMessage(
                    new MailjetEmail(sender, senderName),
                    List.of(new MailjetEmail(toEmail, toName)),
                    subject, textBody, htmlBody)));
            var result = mailjetClient.send(request);
            log.info("[NOTIFICATION] Sent '{}' to {} <{}> — result: {}", subject, toName, toEmail, result);
        } catch (Exception e) {
            log.error("[NOTIFICATION] Failed to send '{}' to {} <{}>", subject, toName, toEmail, e);
        }
    }
}
