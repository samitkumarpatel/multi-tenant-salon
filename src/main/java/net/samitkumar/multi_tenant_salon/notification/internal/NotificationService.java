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
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivityAddedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderPlacedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.format.DateTimeFormatter;
import java.util.Currency;
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
                ? "  (none enabled yet — turn these on from Manage your salon)"
                : features.stream()
                        .map(f -> featureBlurb(f, event.salonHandler()))
                        .map(b -> "  - " + b.title() + ": " + b.description())
                        .collect(Collectors.joining("\n"));
        var htmlFeatures = features.isEmpty()
                ? "<li>None enabled yet — turn these on from Manage your salon.</li>"
                : features.stream()
                        .map(f -> featureBlurb(f, event.salonHandler()))
                        .map(b -> "<li><strong>" + b.title() + "</strong> — " + b.description() + "</li>")
                        .collect(Collectors.joining("\n"));

        var subject = "Welcome to SalonSaaS! \"" + event.salonName() + "\" is live";
        var text = """
                Hi %s,

                Your salon "%s" is now live on SalonSaaS.

                Manage your salon: %s
                Your staff portal: %s

                Features enabled:
                %s

                Need a hand? Reply to this email or reach us at %s.

                — The SalonSaaS Team
                """.formatted(event.ownerName(), event.salonName(), manageLink, staffAppUrl, textFeatures, supportEmail);
        var html = """
                <p>Hi %s,</p>
                <p>Your salon "<strong>%s</strong>" is now live on SalonSaaS.</p>

                <p><a href="%s">Manage your salon</a><br>
                <a href="%s">Your staff portal</a></p>

                <p><strong>Features enabled</strong></p>
                <ul>
                %s
                </ul>

                <p><small>Need a hand? Reply to this email or reach us at <a href="mailto:%s">%s</a>.</small></p>
                """.formatted(event.ownerName(), event.salonName(), manageLink, staffAppUrl, htmlFeatures, supportEmail, supportEmail);

        sendEmail(event.ownerEmail(), event.ownerName(), subject, text, html);
    }

    private record FeatureBlurb(String title, String description) {}

    private FeatureBlurb featureBlurb(SalonFeature feature, String handler) {
        return switch (feature) {
            case STATIC_WEBSITE -> new FeatureBlurb("Public Website", "Live at " + websiteUrl(handler));
            case BOOKING -> new FeatureBlurb("Online Booking", "Live at " + bookingUrl(handler));
            case MEMBERSHIP -> new FeatureBlurb("Memberships", "Sell membership plans to your regulars");
            case LOYALTY_PROGRAM -> new FeatureBlurb("Loyalty Program", "Reward repeat customers with points");
            case ANALYTICS -> new FeatureBlurb("Analytics", "Track visits, bookings, and revenue");
            case WEBSHOP -> new FeatureBlurb("Webshop", "Sell retail products online");
        };
    }

    void notifySalonDisabled(SalonDisabledEvent event) {
        var subject = "Your salon \"" + event.salonName() + "\" has been disabled";
        var text = """
                Hi %s,

                Your salon "%s" has been disabled and is no longer visible to customers.

                If this wasn't expected, write to us at %s.

                — The SalonSaaS Team
                """.formatted(event.ownerName(), event.salonName(), supportEmail);
        var html = """
                <p>Hi %s,</p>
                <p>Your salon "<strong>%s</strong>" has been disabled and is no longer visible to customers.</p>
                <p><small>If this wasn't expected, write to us at <a href="mailto:%s">%s</a>.</small></p>
                """.formatted(event.ownerName(), event.salonName(), supportEmail, supportEmail);

        sendEmail(event.ownerEmail(), event.ownerName(), subject, text, html);
    }

    void notifySalonUpdated(SalonUpdatedEvent event) {
        var manageLink = adminSalonUrl(event.salonId());
        var subject = "Your salon \"" + event.salonName() + "\" settings were updated";
        var text = """
                Hi %s,

                Your salon "%s" settings were just updated.

                Review your salon: %s

                If this wasn't you, write to us at %s immediately.

                — The SalonSaaS Team
                """.formatted(event.ownerName(), event.salonName(), manageLink, supportEmail);
        var html = """
                <p>Hi %s,</p>
                <p>Your salon "<strong>%s</strong>" settings were just updated.</p>
                <p><a href="%s">Review your salon</a></p>
                <p><small>If this wasn't you, write to us at <a href="mailto:%s">%s</a> immediately.</small></p>
                """.formatted(event.ownerName(), event.salonName(), manageLink, supportEmail, supportEmail);

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
        var subject = salonSubject(event.salonName(), (autoConfirmed ? "Booking confirmed — " : "Booking received — ") + formattedDateTime(event));
        var text = """
                Hi %s,

                We've received your booking request (#%d) for %s at %s.

                %s
                %s
                %s
                """.formatted(event.customerName(), event.bookingId(), formattedDateTime(event), event.startTime().format(TIME_FMT), statusLine,
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>We've received your booking request (#%d) for <strong>%s</strong>.</p>
                <p>%s</p>
                %s
                %s
                """.formatted(event.customerName(), event.bookingId(), formattedDateTime(event), statusLine,
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));

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
        var subject = salonSubject(event.salonName(), "Booking update — " + event.newStatus());
        var text = """
                Hi %s,

                %s

                Booking #%d — %s at %s
                %s
                %s
                """.formatted(event.customerName(), message, event.bookingId(),
                event.appointmentDate() != null ? event.appointmentDate().format(DATE_FMT) : "—",
                event.startTime() != null ? event.startTime().format(TIME_FMT) : "—",
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>%s</p>
                <p>Booking #%d — %s at %s</p>
                %s
                %s
                """.formatted(event.customerName(), message, event.bookingId(),
                event.appointmentDate() != null ? event.appointmentDate().format(DATE_FMT) : "—",
                event.startTime() != null ? event.startTime().format(TIME_FMT) : "—",
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html);
    }

    void notifyBookingRescheduled(BookingRescheduledEvent event) {
        var subject = salonSubject(event.salonName(), "Your appointment has been rescheduled");
        var text = """
                Hi %s,

                Your booking #%d has been rescheduled to %s at %s.
                %s
                %s
                """.formatted(event.customerName(), event.bookingId(),
                event.newAppointmentDate().format(DATE_FMT), event.newStartTime().format(TIME_FMT),
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>Your booking #%d has been rescheduled to <strong>%s at %s</strong>.</p>
                %s
                %s
                """.formatted(event.customerName(), event.bookingId(),
                event.newAppointmentDate().format(DATE_FMT), event.newStartTime().format(TIME_FMT),
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));

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

                If this doesn't look right, reply to this email or reach us at %s.

                — The SalonSaaS Team
                """.formatted(event.staffName(), roleLabel, salonName, staffAppUrl, supportEmail);
        var html = """
                <p>Hi %s,</p>
                <p>You've been added as a <strong>%s</strong> at "<strong>%s</strong>" on SalonSaaS.</p>
                <p><a href="%s">Your staff portal</a></p>
                <p><small>If this doesn't look right, reply to this email or reach us at <a href="mailto:%s">%s</a>.</small></p>
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

    // ── Shop / orders ────────────────────────────────────────────────────────

    void notifyOrderPlaced(OrderPlacedEvent event) {
        var subject = salonSubject(event.salonName(), "Order received — " + event.orderNumber());
        var total = formatMoney(event.subtotal(), event.currency());
        var text = """
                Hi %s,

                Thanks for your order! We've received order %s — %d item%s, %s.

                Payment was completed and the salon has been notified. You'll get another
                message as your order moves to processing and then fulfilment.
                %s
                %s
                """.formatted(event.customerName(), event.orderNumber(), event.itemCount(),
                event.itemCount() == 1 ? "" : "s", total,
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>Thanks for your order! We've received order <strong>%s</strong> — %d item%s, <strong>%s</strong>.</p>
                <p>Payment was completed and the salon has been notified. You'll get another message as your order moves to processing and then fulfilment.</p>
                %s
                %s
                """.formatted(event.customerName(), event.orderNumber(), event.itemCount(),
                event.itemCount() == 1 ? "" : "s", total,
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html);
    }

    void notifyOrderStatusChanged(OrderStatusChangedEvent event) {
        var message = switch (event.newStatus()) {
            case NEW -> "Your order has been placed and is awaiting processing.";
            case PROCESSING -> "Your order is now being prepared.";
            case SHIPPED -> "Your order has been shipped!";
            case FULFILLED -> "Your order has been fulfilled. Thank you for shopping with us!";
            case CANCELLED -> "Your order has been cancelled. Please contact the salon if this is unexpected.";
        };
        var subject = salonSubject(event.salonName(), "Order update — " + event.orderNumber());
        var text = """
                Hi %s,

                %s

                Order %s
                %s
                %s
                """.formatted(event.customerName(), message, event.orderNumber(),
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>%s</p>
                <p>Order <strong>%s</strong></p>
                %s
                %s
                """.formatted(event.customerName(), message, event.orderNumber(),
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html);
    }

    void notifyOrderLineUser(OrderLineActivityAddedEvent event) {
        var subject = salonSubject(event.salonName(), "Update on your order — " + event.orderNumber());
        var body = StringUtils.hasText(event.message()) ? event.message() : "There's an update on your order.";
        var text = """
                Hi %s,

                %s

                Regarding: %s (order %s)
                %s
                """.formatted(event.customerName(), body, event.productName(), event.orderNumber(),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>%s</p>
                <p><small>Regarding: %s (order %s)</small></p>
                %s
                """.formatted(event.customerName(), body, event.productName(), event.orderNumber(),
                teamSignatureHtml(event.salonName()));

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html);
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

    private String salonContactDetails(String salonPhone, String salonEmail) {
        var parts = new java.util.ArrayList<String>();
        if (StringUtils.hasText(salonPhone)) parts.add(salonPhone);
        if (StringUtils.hasText(salonEmail)) parts.add(salonEmail);
        return String.join(" / ", parts);
    }

    private String salonContactText(String salonName, String salonPhone, String salonEmail) {
        var contact = salonContactDetails(salonPhone, salonEmail);
        if (!StringUtils.hasText(contact)) return "";
        var name = StringUtils.hasText(salonName) ? salonName : "the salon";
        return "\nQuestions? Contact " + name + " at " + contact + ".\n";
    }

    private String salonContactHtml(String salonName, String salonPhone, String salonEmail) {
        var contact = salonContactDetails(salonPhone, salonEmail);
        if (!StringUtils.hasText(contact)) return "";
        var name = StringUtils.hasText(salonName) ? salonName : "the salon";
        return "<p><small>Questions? Contact " + name + " at " + contact + ".</small></p>";
    }

    /** Customer-facing booking emails are branded per-salon: "SalonSaaS[<salon>] <subject>". */
    private String salonSubject(String salonName, String subject) {
        return StringUtils.hasText(salonName) ? "SalonSaaS[" + salonName + "] " + subject : "SalonSaaS " + subject;
    }

    private String teamSignatureText(String salonName) {
        return "Regards,\nTeam " + (StringUtils.hasText(salonName) ? salonName : "SalonSaaS");
    }

    private String teamSignatureHtml(String salonName) {
        return "<p><small>Regards,<br>Team " + (StringUtils.hasText(salonName) ? salonName : "SalonSaaS") + "</small></p>";
    }

    /** "12.50" + "EUR" → "€12.50"; falls back to "12.50 EUR" for an unknown currency code. */
    private String formatMoney(BigDecimal amount, String currencyCode) {
        var value = amount != null ? amount : BigDecimal.ZERO;
        try {
            var fmt = NumberFormat.getCurrencyInstance(Locale.US);
            fmt.setCurrency(Currency.getInstance(StringUtils.hasText(currencyCode) ? currencyCode : "USD"));
            return fmt.format(value);
        } catch (RuntimeException e) {
            return value.toPlainString() + " " + (StringUtils.hasText(currencyCode) ? currencyCode : "USD");
        }
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
