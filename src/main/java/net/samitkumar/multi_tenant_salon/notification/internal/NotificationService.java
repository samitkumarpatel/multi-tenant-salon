package net.samitkumar.multi_tenant_salon.notification.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingPaymentLinkEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingRescheduledEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.booking.BookingStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideAddedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffAvailabilityOverrideRemovedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffBookingAssignedEvent;
import net.samitkumar.multi_tenant_salon.booking.StaffScheduleUpdatedEvent;
import net.samitkumar.multi_tenant_salon.customer.CustomerSignInCodeRequestedEvent;
import net.samitkumar.multi_tenant_salon.membership.BillingInterval;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivatedEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipCancelledEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipCustomerNotifiedEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipRenewalDueEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonDisabledEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salon.SalonUpdatedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderCustomerNotifiedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderLineActivityAddedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderPlacedEvent;
import net.samitkumar.multi_tenant_salon.shop.OrderStatusChangedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import net.samitkumar.multi_tenant_salon.utility.QrCodes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.web.util.HtmlUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClientResponseException;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Base64;
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

    // Help Center guides (wiki/content/docs) linked from owner- and staff-facing emails.
    private static final String GUIDE_GETTING_STARTED = "getting-started/sign-up-and-onboarding";
    private static final String GUIDE_SALON_SETTINGS = "getting-started/salon-profile-and-settings";
    private static final String GUIDE_STAFF_PORTAL = "staff-portal/logging-in-and-your-schedule";

    private final MailjetClient mailjetClient;
    private final ApplicationEventPublisher eventPublisher;

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
    // Help Center for salon owners and staff only — never link it from a customer-facing email.
    @Value("${spring.application.notification.help-url:https://help.salonsaas.org}")
    private String helpUrl;

    NotificationService(MailjetClient mailjetClient, ApplicationEventPublisher eventPublisher) {
        this.mailjetClient = mailjetClient;
        this.eventPublisher = eventPublisher;
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

                New here? Our step-by-step setup guide walks you through services, staff, bookings and payments:
                %s

                Features enabled:
                %s

                Need a hand? Browse the Help Center (%s), reply to this email or reach us at %s.

                — The SalonSaaS Team
                """.formatted(event.ownerName(), event.salonName(), manageLink, staffAppUrl,
                helpUrl(GUIDE_GETTING_STARTED), textFeatures, helpUrl(""), supportEmail);
        var html = """
                <p>Hi %s,</p>
                <p>Your salon "<strong>%s</strong>" is now live on SalonSaaS.</p>

                <p><a href="%s">Manage your salon</a><br>
                <a href="%s">Your staff portal</a></p>

                <p>New here? Our <a href="%s"><strong>step-by-step setup guide</strong></a> walks you through services, staff, bookings and payments.</p>

                <p><strong>Features enabled</strong></p>
                <ul>
                %s
                </ul>

                <p><small>Need a hand? Browse the <a href="%s">Help Center</a>, reply to this email or reach us at <a href="mailto:%s">%s</a>.</small></p>
                """.formatted(event.ownerName(), event.salonName(), manageLink, staffAppUrl,
                helpUrl(GUIDE_GETTING_STARTED), htmlFeatures, helpUrl(""), supportEmail, supportEmail);

        sendEmail(event.ownerEmail(), event.ownerName(), subject, text, html);
    }

    private record FeatureBlurb(String title, String description) {}

    private FeatureBlurb featureBlurb(SalonFeature feature, String handler) {
        return switch (feature) {
            case STATIC_WEBSITE -> new FeatureBlurb("Public Website", "Live at " + websiteUrl(handler));
            case BOOKING -> new FeatureBlurb("Online Booking", "Live at " + bookingUrl(handler));
            case DASHBOARD -> new FeatureBlurb("Operations Dashboard", "Manage appointments, checkout, and customer communication");
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
                What each setting does: %s

                If this wasn't you, write to us at %s immediately.

                — The SalonSaaS Team
                """.formatted(event.ownerName(), event.salonName(), manageLink, helpUrl(GUIDE_SALON_SETTINGS), supportEmail);
        var html = """
                <p>Hi %s,</p>
                <p>Your salon "<strong>%s</strong>" settings were just updated.</p>
                <p><a href="%s">Review your salon</a> · <a href="%s">What each setting does</a></p>
                <p><small>If this wasn't you, write to us at <a href="mailto:%s">%s</a> immediately.</small></p>
                """.formatted(event.ownerName(), event.salonName(), manageLink, helpUrl(GUIDE_SALON_SETTINGS), supportEmail, supportEmail);

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

        var sms = "Hi " + event.customerName() + ": we received your booking request (#" + event.bookingId() + ") for "
                + formattedDateTime(event) + " at " + event.startTime().format(TIME_FMT) + ". " + statusLine + " — " + event.salonName();
        sendBookingCustomerMessage(event.customerEmail(), event.customerPhone(), event.customerName(), subject, text, html, sms);
    }

    void notifyBookingPaymentLink(BookingPaymentLinkEvent event) {
        var when = event.appointmentDate().format(DATE_FMT) + " at " + event.startTime().format(TIME_FMT);
        var price = formatMoney(event.amount(), event.currency());
        var subject = salonSubject(event.salonName(), "Payment due for your appointment on " + event.appointmentDate().format(DATE_FMT));
        var text = """
                Hi %s,

                Our records show a payment is still due for your %s appointment (#%d) on %s.

                Pay %s securely online: %s
                The link stays open for 24 hours — contact us if you need a new one.
                %s
                %s
                """.formatted(event.customerName(), event.serviceName(), event.bookingId(), when, price, event.paymentUrl(),
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>Our records show a payment is still due for your <strong>%s</strong> appointment (#%d) on %s.</p>
                <p><a href="%s" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600">Pay %s</a></p>
                <p><small>The link stays open for 24 hours — contact us if you need a new one. Or open: %s</small></p>
                %s
                %s
                """.formatted(HtmlUtils.htmlEscape(event.customerName()), HtmlUtils.htmlEscape(event.serviceName()), event.bookingId(),
                HtmlUtils.htmlEscape(when), HtmlUtils.htmlEscape(event.paymentUrl()), price, HtmlUtils.htmlEscape(event.paymentUrl()),
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
        var reviewUrl = event.reviewToken() == null ? null : bookingAppUrl + "/review/" + event.reviewToken();
        var reviewText = reviewUrl == null ? "" : "\n\nHow was your visit? Rate the salon and your stylist here:\n" + reviewUrl;
        var reviewHtml = reviewUrl == null ? "" : "<p>How was your visit? <a href=\"" + HtmlUtils.htmlEscape(reviewUrl) + "\">Rate the salon and your stylist</a>.</p>";
        var text = """
                Hi %s,

                %s

                Booking #%d — %s at %s
                %s
                %s
                %s
                """.formatted(event.customerName(), message, event.bookingId(),
                event.appointmentDate() != null ? event.appointmentDate().format(DATE_FMT) : "—",
                event.startTime() != null ? event.startTime().format(TIME_FMT) : "—",
                reviewText,
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>%s</p>
                <p>Booking #%d — %s at %s</p>
                %s
                %s
                %s
                """.formatted(event.customerName(), message, event.bookingId(),
                event.appointmentDate() != null ? event.appointmentDate().format(DATE_FMT) : "—",
                event.startTime() != null ? event.startTime().format(TIME_FMT) : "—",
                reviewHtml,
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
                How to sign in and use it: %s

                If this doesn't look right, reply to this email or reach us at %s.

                — The SalonSaaS Team
                """.formatted(event.staffName(), roleLabel, salonName, staffAppUrl, helpUrl(GUIDE_STAFF_PORTAL), supportEmail);
        var html = """
                <p>Hi %s,</p>
                <p>You've been added as a <strong>%s</strong> at "<strong>%s</strong>" on SalonSaaS.</p>
                <p><a href="%s">Your staff portal</a> · <a href="%s">How to sign in and use it</a></p>
                <p><small>If this doesn't look right, reply to this email or reach us at <a href="mailto:%s">%s</a>.</small></p>
                """.formatted(event.staffName(), roleLabel, salonName, staffAppUrl, helpUrl(GUIDE_STAFF_PORTAL), supportEmail, supportEmail);

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
                How availability works: %s

                If this doesn't look right, please contact your salon manager.

                — The SalonSaaS Team
                """.formatted(event.staffName(), event.scheduleEntriesCount(), staffAppUrl, helpUrl(GUIDE_STAFF_PORTAL));
        var html = """
                <p>Hi %s,</p>
                <p>Your weekly availability has been updated — <strong>%d day(s)</strong> now set.</p>
                <p><a href="%s">View your schedule</a> · <a href="%s">How availability works</a></p>
                <p><small>If this doesn't look right, please contact your salon manager.</small></p>
                """.formatted(event.staffName(), event.scheduleEntriesCount(), staffAppUrl, helpUrl(GUIDE_STAFF_PORTAL));

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
        var total = formatMoney(event.total(), event.currency());
        if (event.shippingMethodName() != null) {
            total += " incl. " + (event.shippingCost() == null || event.shippingCost().signum() == 0
                    ? "free" : formatMoney(event.shippingCost(), event.currency())) + " shipping (" + event.shippingMethodName() + ")";
        }
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
                event.itemCount() == 1 ? "" : "s", HtmlUtils.htmlEscape(total),
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html,
                NotificationContext.shopOrder(event.salonId(), event.orderNumber()));
    }

    void notifyOrderStatusChanged(OrderStatusChangedEvent event) {
        var message = switch (event.newStatus()) {
            case NEW -> "Your order has been placed and is awaiting processing.";
            case CONFIRMED -> "Your order has been confirmed.";
            case PROCESSING -> "Your order is now being prepared.";
            case READY_TO_SHIP -> "Your order is ready to ship.";
            case SHIPPED -> "Your order has been shipped!";
            case DELIVERED -> "Your order has been delivered.";
            case FULFILLED -> "Your order has been fulfilled. Thank you for shopping with us!";
            case CANCELLED -> "Your order has been cancelled. Please contact the salon if this is unexpected.";
            case FAILED -> "There was a problem with your order. Please contact us.";
            case ON_HOLD -> "Your order is currently on hold. We will update you shortly.";
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

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html,
                NotificationContext.shopOrder(event.salonId(), event.orderNumber()));
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

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html,
                NotificationContext.shopOrder(event.salonId(), event.orderNumber()));
    }

    // ── Memberships — customer-facing ─────────────────────────────────────────

    /** Content-ID the welcome email's HTML uses to show the inline QR attachment. */
    private static final String MEMBER_QR_CID = "member-qr";

    void notifyMembershipActivated(MembershipActivatedEvent event) {
        var subject = salonSubject(event.salonName(), switch (event.kind()) {
            case WELCOME -> "Welcome! Your membership — ";
            case RENEWED -> "Membership renewed — ";
            case RESEND -> "Your membership card — ";
        } + event.planName());
        var price = formatMoney(event.price(), event.currency()) + " " + intervalLabel(event.billingInterval());
        var renews = event.currentPeriodEnd() == null ? null : event.currentPeriodEnd().atZone(ZoneOffset.UTC).format(DATE_FMT);
        var perks = event.perks() == null ? List.<String>of() : event.perks();
        var intro = switch (event.kind()) {
            case WELCOME -> "Thank you for joining! Your payment went through and your membership is active.";
            case RENEWED -> "Thank you for renewing! Your payment went through and your membership continues.";
            case RESEND -> "Here's your membership card again.";
        };
        var text = """
                Hi %s,

                %s

                Plan        : %s
                Price       : %s
                Member code : %s
                %s%s
                Show the QR code in this email (or tell the salon your member code) at your next visit.
                %s
                %s
                """.formatted(event.customerName(), intro, event.planName(), price, event.memberCode(),
                renews == null ? "" : "Member until: " + renews + " — we'll email you a renewal link before then\n",
                perks.isEmpty() ? "" : "\nYour perks:\n" + perks.stream().map(p -> "  - " + p).collect(Collectors.joining("\n")) + "\n",
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>%s</p>
                <div style="border:1px solid #e2e8f0;border-radius:12px;padding:20px;max-width:360px;text-align:center">
                  <p style="margin:0 0 4px;font-size:18px"><strong>%s</strong></p>
                  <p style="margin:0 0 12px;color:#64748b">%s</p>
                  <img src="cid:%s" width="220" height="220" alt="Membership QR code" style="display:block;margin:0 auto">
                  <p style="margin:12px 0 0;font-family:monospace;font-size:18px;letter-spacing:2px">%s</p>
                  %s
                </div>
                <p>Show this QR code (or tell the salon your member code) at your next visit.</p>
                %s
                %s
                %s
                """.formatted(HtmlUtils.htmlEscape(event.customerName()), intro, HtmlUtils.htmlEscape(event.planName()), price,
                MEMBER_QR_CID, event.memberCode(),
                renews == null ? "" : "<p style=\"margin:8px 0 0;color:#64748b;font-size:13px\">Member until " + renews + "</p>",
                perks.isEmpty() ? "" : "<p><strong>Your perks</strong></p><ul>"
                        + perks.stream().map(p -> "<li>" + HtmlUtils.htmlEscape(p) + "</li>").collect(Collectors.joining()) + "</ul>",
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));
        var qr = new MailjetAttachment("image/png", "membership-" + event.memberCode() + ".png", MEMBER_QR_CID,
                Base64.getEncoder().encodeToString(QrCodes.png(event.memberCode(), 440)));

        var status = dispatch(event.customerEmail(), event.customerName(), subject, text, html, List.of(qr));
        acknowledge(event.customerEmail(), subject, text, status,
                NotificationContext.membership(event.salonId(), event.subscriptionId()));
    }

    void notifyMembershipCancelled(MembershipCancelledEvent event) {
        var endsOn = event.endsAt() == null ? null : event.endsAt().atZone(ZoneOffset.UTC).format(DATE_FMT);
        var message = event.immediate() || endsOn == null
                ? "Your " + event.planName() + " membership has been cancelled and has now ended. You won't be charged again."
                : "Your " + event.planName() + " membership has been cancelled. It stays active until " + endsOn
                        + " and won't renew after that.";
        var subject = salonSubject(event.salonName(), "Membership cancelled — " + event.planName());
        var text = """
                Hi %s,

                %s

                Member code: %s
                If this wasn't expected, please contact the salon.
                %s
                %s
                """.formatted(event.customerName(), message, event.memberCode(),
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>%s</p>
                <p><small>Member code: %s. If this wasn't expected, please contact the salon.</small></p>
                %s
                %s
                """.formatted(HtmlUtils.htmlEscape(event.customerName()), HtmlUtils.htmlEscape(message), event.memberCode(),
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html,
                NotificationContext.membership(event.salonId(), event.subscriptionId()));
    }

    void notifyMembershipRenewalDue(MembershipRenewalDueEvent event) {
        var endDate = event.periodEnd() == null ? null : event.periodEnd().atZone(ZoneOffset.UTC).format(DATE_FMT);
        var link = websiteUrl(event.salonHandler()) + "/membership?renew=" + event.renewalToken();
        var price = formatMoney(event.price(), event.currency()) + " " + intervalLabel(event.billingInterval());
        var subject = salonSubject(event.salonName(), (event.expired() ? "Your membership has ended — renew " : "Time to renew your ")
                + event.planName() + (event.expired() ? "" : " membership"));
        var message = event.expired()
                ? "Your " + event.planName() + " membership ended" + (endDate == null ? "" : " on " + endDate)
                        + ". Renew any time to pick up where you left off — you keep your member code."
                : "Your " + event.planName() + " membership runs until " + endDate
                        + ". Renew now so it continues without a gap — the new period starts when the current one ends.";
        var text = """
                Hi %s,

                %s

                Renew (%s): %s
                %s
                %s
                """.formatted(event.customerName(), message, price, link,
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi %s,</p>
                <p>%s</p>
                <p><a href="%s" style="display:inline-block;padding:10px 18px;border-radius:8px;background:#0f172a;color:#ffffff;text-decoration:none;font-weight:600">Renew — %s</a></p>
                <p><small>Or open this link: %s</small></p>
                %s
                %s
                """.formatted(HtmlUtils.htmlEscape(event.customerName()), HtmlUtils.htmlEscape(message), HtmlUtils.htmlEscape(link),
                price, HtmlUtils.htmlEscape(link),
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));

        sendEmail(event.customerEmail(), event.customerName(), subject, text, html,
                NotificationContext.membership(event.salonId(), event.subscriptionId()));
    }

    // ── Customer account ─────────────────────────────────────────────────────

    /** The one-time sign-in code. Transactional, so it goes out whatever the customer's marketing preferences. */
    void notifyCustomerSignInCode(CustomerSignInCodeRequestedEvent event) {
        var minutes = Math.max(1, Duration.between(Instant.now(), event.expiresAt()).toMinutes());
        // Not in the subject: subjects are logged on every send.
        var subject = salonSubject(event.salonName(), "Your sign-in code");
        var text = """
                Hi,

                Your code to sign in to your %s account is:

                %s

                It works once and expires in %d minutes. If you didn't ask to sign in, you can ignore this email.
                %s
                %s
                """.formatted(event.salonName(), event.code(), minutes,
                salonContactText(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureText(event.salonName()));
        var html = """
                <p>Hi,</p>
                <p>Your code to sign in to your %s account is:</p>
                <p style="font-size:28px;font-weight:700;letter-spacing:6px;font-family:monospace">%s</p>
                <p>It works once and expires in %d minutes. If you didn't ask to sign in, you can ignore this email.</p>
                %s
                %s
                """.formatted(HtmlUtils.htmlEscape(event.salonName()), event.code(), minutes,
                salonContactHtml(event.salonName(), event.salonPhone(), event.salonEmail()),
                teamSignatureHtml(event.salonName()));
        if (!StringUtils.hasText(apiKey)) {
            // Local development has no Mailjet, and there is no other way to read the code.
            log.info("[NOTIFICATION] Mailjet not configured — sign-in code for {} at salon {} is {}", event.email(), event.salonId(), event.code());
        }
        sendEmail(event.email(), null, subject, text, html);
    }

    private static String intervalLabel(BillingInterval interval) {
        return switch (interval) {
            case MONTHLY -> "per month";
            case QUARTERLY -> "every 3 months";
            case YEARLY -> "per year";
        };
    }

    // ── Dispatch ──────────────────────────────────────────────────────────────

    // Emails are English-only, so they link the English guides.
    private String helpUrl(String guide) {
        return helpUrl + "/en/docs" + (guide.isEmpty() ? "" : "/" + guide);
    }

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

    private void sendBookingCustomerMessage(String email, String phone, String name, String subject,
                                            String text, String html, String smsText) {
        if (StringUtils.hasText(email)) {
            sendEmail(email, name, subject, text, html);
        } else if (StringUtils.hasText(phone)) {
            // SMS delivery is intentionally a placeholder until an SMS provider is selected.
            log.info("[SMS MOCK → CUSTOMER] to={} body={}", phone, smsText);
        } else {
            log.warn("[NOTIFICATION] Booking customer has no email or phone — skipping booking message.");
        }
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

    /** Fire-and-forget send with no audit trail — used for internal (salon/staff) notifications. */
    private void sendEmail(String toEmail, String toName, String subject, String textBody, String htmlBody) {
        dispatch(toEmail, toName, subject, textBody, htmlBody);
    }

    /**
     * Send, then publish an acknowledgement event so the owning module can record exactly what the
     * customer received (subject + body + delivery status) on its own timeline.
     */
    private void sendEmail(String toEmail, String toName, String subject, String textBody, String htmlBody,
                           NotificationContext ctx) {
        var status = dispatch(toEmail, toName, subject, textBody, htmlBody);
        acknowledge(toEmail, subject, textBody, status, ctx);
    }

    /**
     * The one place that actually talks to Mailjet. Every caller is an {@code @ApplicationModuleListener},
     * so this runs after the business change has committed and can't break it. A temporary failure
     * (network, Mailjet 5xx/429) throws {@link NotificationDeliveryException}: Spring Modulith then marks
     * the event publication failed and the retry job sends the email again later. A permanent one (no
     * recipient, Mailjet rejecting the message) returns {@code FAILED} — retrying would never help.
     */
    private DispatchStatus dispatch(String toEmail, String toName, String subject, String textBody, String htmlBody) {
        return dispatch(toEmail, toName, subject, textBody, htmlBody, List.of());
    }

    private DispatchStatus dispatch(String toEmail, String toName, String subject, String textBody, String htmlBody,
                                    List<MailjetAttachment> inlined) {
        if (toEmail != null && toEmail.toLowerCase(Locale.ROOT).endsWith("@anonymized.invalid")) return DispatchStatus.FAILED;
        if (!StringUtils.hasText(toEmail)) {
            log.warn("[NOTIFICATION] No recipient email — skipping send. subject='{}'", subject);
            return DispatchStatus.FAILED;
        }
        if (!StringUtils.hasText(apiKey)) {
            log.info("[NOTIFICATION] Mailjet not configured — skipping send. to={} <{}> subject='{}'", toName, toEmail, subject);
            return DispatchStatus.LOGGED;
        }
        try {
            var request = new MailjetRequest(List.of(new MailjetMessage(
                    new MailjetEmail(sender, senderName),
                    List.of(new MailjetEmail(toEmail, toName)),
                    subject, textBody, htmlBody, inlined)));
            var result = mailjetClient.send(request);
            log.info("[NOTIFICATION] Sent '{}' to {} <{}> — result: {}", subject, toName, toEmail, result);
            return DispatchStatus.SENT;
        } catch (RestClientResponseException e) {
            var code = e.getStatusCode();
            if (code.is4xxClientError() && code.value() != 429) {
                log.error("[NOTIFICATION] Mailjet rejected '{}' to {} <{}> ({}) — not retrying: {}",
                        subject, toName, toEmail, code.value(), e.getResponseBodyAsString());
                return DispatchStatus.FAILED;
            }
            throw new NotificationDeliveryException("Mailjet answered " + code.value() + " for '" + subject + "' to " + toEmail, e);
        } catch (RuntimeException e) {
            throw new NotificationDeliveryException("Could not reach Mailjet for '" + subject + "' to " + toEmail, e);
        }
    }

    /** A temporary delivery failure; thrown so Spring Modulith keeps the event publication for a retry. */
    static class NotificationDeliveryException extends RuntimeException {
        NotificationDeliveryException(String message, Throwable cause) {
            super(message, cause);
        }
    }

    /**
     * Tells the entity's owning module what was sent, via an acknowledgement event it already owns
     * (keeps the round-trip event-driven and cycle-free). A failure here must never break sending.
     */
    private void acknowledge(String toEmail, String subject, String body,
                             DispatchStatus status, NotificationContext ctx) {
        if (ctx == null) return;
        try {
            if (NotificationContext.TYPE_SHOP_ORDER.equals(ctx.relatedType())) {
                eventPublisher.publishEvent(new OrderCustomerNotifiedEvent(
                        ctx.salonId(), ctx.relatedRef(), OrderCustomerNotifiedEvent.CHANNEL_EMAIL,
                        toEmail, subject, body, status.name(), Instant.now()));
            } else if (NotificationContext.TYPE_MEMBERSHIP.equals(ctx.relatedType())) {
                eventPublisher.publishEvent(new MembershipCustomerNotifiedEvent(
                        ctx.salonId(), Long.valueOf(ctx.relatedRef()), MembershipCustomerNotifiedEvent.CHANNEL_EMAIL,
                        toEmail, subject, status.name(), Instant.now()));
            }
        } catch (Exception e) {
            log.error("[NOTIFICATION] Failed to publish notification acknowledgement for subject='{}'", subject, e);
        }
    }

    /** What happened when we tried to hand the message to the provider. */
    enum DispatchStatus { SENT, LOGGED, FAILED }
}
