package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingRescheduledEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideAddedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideRemovedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffBookingAssignedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffScheduleUpdatedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonDisabledEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salon.SalonUpdatedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

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
    @Value("${spring.application.notification.booking-app-url:https://book.salonsaas.org}")
    private String bookingAppUrl;
    @Value("${spring.application.notification.support-email:admin@salonsaas.org}")
    private String supportEmail;

    NotificationService(MailjetClient mailjetClient) {
        this.mailjetClient = mailjetClient;
    }

    // ── Salon lifecycle ──────────────────────────────────────────────────────

    void notifySalonOnboarded(SalonCreatedEvent event) {
        var manageLink = adminSalonUrl(event.salonId());
        var features = event.features();

        var textFeatures = features.isEmpty()
                ? "  (none enabled yet — turn these on anytime from Manage your salon)"
                : features.stream()
                        .map(f -> featureBlurb(f, event.salonHandler()))
                        .map(b -> "  - " + b.title() + ": " + b.description())
                        .collect(Collectors.joining("\n"));
        var htmlFeatures = features.isEmpty()
                ? "<li>None enabled yet — turn these on anytime from Manage your salon.</li>"
                : features.stream()
                        .map(f -> featureBlurb(f, event.salonHandler()))
                        .map(b -> "<li><strong>" + b.title() + "</strong> — " + b.description() + "</li>")
                        .collect(Collectors.joining("\n"));

        var subject = "Welcome to SalonSaaS! \"" + event.salonName() + "\" is live";
        var text = """
                Hi %s,

                Welcome to SalonSaaS! Your salon "%s" has been created successfully.

                MANAGE YOUR SALON
                %s
                Add and manage staff, add your services and pricing, set operating hours, turn features on or off, and handle all your salon's administrative work from here.

                YOUR STAFF PORTAL
                %s
                Share this link with your team — each staff member signs in here to manage their own profile, schedule, holidays, and assigned appointments.

                FEATURES ENABLED FOR YOUR SALON
                %s

                Need a hand? Just reply to this email, or reach us anytime at %s.

                — The SalonSaaS Team
                """.formatted(event.ownerName(), event.salonName(), manageLink, staffAppUrl, textFeatures, supportEmail);
        var html = """
                <p>Hi %s,</p>
                <p>Welcome to <strong>SalonSaaS</strong>! Your salon "<strong>%s</strong>" has been created successfully.</p>

                <p><strong><a href="%s">Manage your salon</a></strong><br>
                <small>Add and manage staff, add your services and pricing, set operating hours, turn features on or off, and handle all your salon's administrative work from here.</small></p>

                <p><strong><a href="%s">Your staff portal</a></strong><br>
                <small>Share this link with your team — each staff member signs in here to manage their own profile, schedule, holidays, and assigned appointments.</small></p>

                <p><strong>Features enabled for your salon</strong></p>
                <ul>
                %s
                </ul>

                <p><small>Need a hand? Just reply to this email, or reach us anytime at <a href="mailto:%s">%s</a>.</small></p>
                """.formatted(event.ownerName(), event.salonName(), manageLink, staffAppUrl, htmlFeatures, supportEmail, supportEmail);

        sendEmail(event.ownerEmail(), event.ownerName(), subject, text, html);
    }

    private record FeatureBlurb(String title, String description) {}

    private FeatureBlurb featureBlurb(SalonFeature feature, String handler) {
        return switch (feature) {
            case STATIC_WEBSITE -> new FeatureBlurb("Public Website",
                    "Live at " + websiteUrl(handler) + ". From Manage your salon you can customize its theme and colors, "
                            + "edit its text, and build new pages with our Gen-UI/MCP app builder.");
            case BOOKING -> new FeatureBlurb("Online Booking",
                    "Customers can book appointments directly at " + bookingUrl(handler) + ". Share this link anywhere — social media, your website, business cards.");
            case MEMBERSHIP -> new FeatureBlurb("Memberships",
                    "Sell recurring membership plans to your regulars, managed from Manage your salon.");
            case LOYALTY_PROGRAM -> new FeatureBlurb("Loyalty Program",
                    "Reward repeat customers with points and perks for every visit.");
            case ANALYTICS -> new FeatureBlurb("Analytics",
                    "Track visits, bookings, and revenue trends from your salon dashboard.");
            case WEBSHOP -> new FeatureBlurb("Webshop",
                    "Sell retail products online directly to your customers.");
        };
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
        // Whether a booking needs the salon's manual sign-off is a per-salon setting
        // (Salon.bookingRequiresConfirmation) — the wording here must match what
        // actually happened, not assume every booking is left pending.
        var autoConfirmed = event.initialStatus() == BookingStatus.CONFIRMED;
        var statusLine = autoConfirmed
                ? "Good news — this salon confirms bookings automatically, so you're all set!"
                : "We'll let you know as soon as it's confirmed.";
        var subject = (autoConfirmed ? "Booking confirmed — " : "Booking received — ") + formattedDateTime(event);
        var text = """
                Hi %s,

                We've received your booking request (#%d) for %s at %s.

                %s

                — The SalonSaaS Team
                """.formatted(event.customerName(), event.bookingId(), formattedDateTime(event), event.startTime().format(TIME_FMT), statusLine);
        var html = """
                <p>Hi %s,</p>
                <p>We've received your booking request (#%d) for <strong>%s</strong>.</p>
                <p>%s</p>
                """.formatted(event.customerName(), event.bookingId(), formattedDateTime(event), statusLine);

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

    // ── Staff onboarding & scheduling — staff-facing ──────────────────────────

    void notifyStaffOnboarded(StaffOnboardedEvent event) {
        if (!StringUtils.hasText(event.staffEmail())) {
            log.info("[NOTIFICATION] New staff {} has no email on file — skipping welcome notification", event.staffId());
            return;
        }
        var roleLabel = humanize(event.role());
        var salonName = event.salonName() != null ? event.salonName() : "your salon";
        var subject = "Welcome to " + salonName + " on SalonSaaS";
        var text = """
                Hi %s,

                You've been added as a %s at "%s" on SalonSaaS.

                Your staff portal: %s
                Sign in with this email address to view your schedule, upcoming appointments, and manage your holidays.

                If this doesn't look right, just reply to this email, or reach us at %s.

                — The SalonSaaS Team
                """.formatted(event.staffName(), roleLabel, salonName, staffAppUrl, supportEmail);
        var html = """
                <p>Hi %s,</p>
                <p>You've been added as a <strong>%s</strong> at "<strong>%s</strong>" on SalonSaaS.</p>
                <p><strong><a href="%s">Your staff portal</a></strong><br>
                <small>Sign in with this email address to view your schedule, upcoming appointments, and manage your holidays.</small></p>
                <p><small>If this doesn't look right, just reply to this email, or reach us at <a href="mailto:%s">%s</a>.</small></p>
                """.formatted(event.staffName(), roleLabel, salonName, staffAppUrl, supportEmail, supportEmail);

        sendEmail(event.staffEmail(), event.staffName(), subject, text, html);
    }

    void notifyStaffScheduleUpdated(StaffScheduleUpdatedEvent event) {
        if (!StringUtils.hasText(event.staffEmail())) {
            log.info("[NOTIFICATION] Staff {} has no email on file — skipping schedule-updated notification", event.staffId());
            return;
        }
        var subject = "Your weekly schedule was updated";
        var text = """
                Hi %s,

                Your weekly availability has been updated — %d day(s) now set.

                View your schedule: %s

                If this doesn't look right, please contact your salon manager.

                — The SalonSaaS Team
                """.formatted(event.staffName(), event.scheduleEntriesCount(), staffAppUrl);
        var html = """
                <p>Hi %s,</p>
                <p>Your weekly availability has been updated — <strong>%d day(s)</strong> now set.</p>
                <p><a href="%s">View your schedule</a></p>
                <p><small>If this doesn't look right, please contact your salon manager.</small></p>
                """.formatted(event.staffName(), event.scheduleEntriesCount(), staffAppUrl);

        sendEmail(event.staffEmail(), event.staffName(), subject, text, html);
    }

    void notifyStaffAvailabilityOverrideAdded(StaffAvailabilityOverrideAddedEvent event) {
        if (!StringUtils.hasText(event.staffEmail())) {
            log.info("[NOTIFICATION] Staff {} has no email on file — skipping availability-override notification", event.staffId());
            return;
        }
        var when = event.available() && event.startTime() != null && event.endTime() != null
                ? event.startTime().format(TIME_FMT) + " – " + event.endTime().format(TIME_FMT)
                : "unavailable all day";
        var reasonText = StringUtils.hasText(event.reason()) ? " (" + event.reason() + ")" : "";
        var subject = "Schedule change for " + event.overrideDate().format(DATE_FMT);
        var text = """
                Hi %s,

                A one-off change was made to your schedule for %s: %s%s.

                View your schedule: %s

                — The SalonSaaS Team
                """.formatted(event.staffName(), event.overrideDate().format(DATE_FMT), when, reasonText, staffAppUrl);
        var html = """
                <p>Hi %s,</p>
                <p>A one-off change was made to your schedule for <strong>%s</strong>: %s%s.</p>
                <p><a href="%s">View your schedule</a></p>
                """.formatted(event.staffName(), event.overrideDate().format(DATE_FMT), when, reasonText, staffAppUrl);

        sendEmail(event.staffEmail(), event.staffName(), subject, text, html);
    }

    void notifyStaffAvailabilityOverrideRemoved(StaffAvailabilityOverrideRemovedEvent event) {
        if (!StringUtils.hasText(event.staffEmail())) {
            log.info("[NOTIFICATION] Staff {} has no email on file — skipping availability-override-removed notification", event.staffId());
            return;
        }
        var subject = "Schedule change reverted for " + event.overrideDate().format(DATE_FMT);
        var text = """
                Hi %s,

                The one-off schedule change for %s has been removed — your regular weekly hours apply again for that day.

                View your schedule: %s

                — The SalonSaaS Team
                """.formatted(event.staffName(), event.overrideDate().format(DATE_FMT), staffAppUrl);
        var html = """
                <p>Hi %s,</p>
                <p>The one-off schedule change for <strong>%s</strong> has been removed — your regular weekly hours apply again for that day.</p>
                <p><a href="%s">View your schedule</a></p>
                """.formatted(event.staffName(), event.overrideDate().format(DATE_FMT), staffAppUrl);

        sendEmail(event.staffEmail(), event.staffName(), subject, text, html);
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────

    private String adminSalonUrl(Object salonId) {
        return adminAppUrl + "/" + salonId;
    }

    private String websiteUrl(String handler) {
        return "https://" + handler + "." + salonDomain;
    }

    private String bookingUrl(String handler) {
        return bookingAppUrl + "/" + handler;
    }

    private String formattedDateTime(BookingCreatedEvent event) {
        return event.appointmentDate().format(DATE_FMT) + " " + event.startTime().format(TIME_FMT) + " – " + event.endTime().format(TIME_FMT);
    }

    /** "MAKEUP_ARTIST" → "Makeup Artist" — enum constants read fine in logs but not in an email a human reads. */
    private String humanize(Enum<?> value) {
        var sb = new StringBuilder();
        for (var part : value.name().split("_")) {
            if (!sb.isEmpty()) sb.append(' ');
            sb.append(part.charAt(0)).append(part.substring(1).toLowerCase(Locale.ENGLISH));
        }
        return sb.toString();
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
