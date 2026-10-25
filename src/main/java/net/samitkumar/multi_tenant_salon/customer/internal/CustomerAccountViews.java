package net.samitkumar.multi_tenant_salon.customer.internal;

import net.samitkumar.multi_tenant_salon.booking.Booking;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.membership.BillingInterval;
import net.samitkumar.multi_tenant_salon.membership.MembershipPayment;
import net.samitkumar.multi_tenant_salon.membership.MembershipSubscription;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.shop.OrderStatus;
import net.samitkumar.multi_tenant_salon.shop.PaymentStatus;
import net.samitkumar.multi_tenant_salon.shop.ShopOrder;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderActivity;
import net.samitkumar.multi_tenant_salon.shop.ShopOrderHistoryApi;
import net.samitkumar.multi_tenant_salon.staff.StaffMember;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;
import java.util.regex.Pattern;

/**
 * What the customer account returns. Explicit views rather than the module records, so nothing
 * staff-facing (payment references, internal notes, the email bodies) reaches the customer by accident.
 */
final class CustomerAccountViews {

    private CustomerAccountViews() {}

    record SignInRequest(String email) {}

    record SignInAccepted(int codeLength, long expiresInSeconds) {}

    record VerifyRequest(String email, String code) {}

    record SessionView(String sessionToken, String email, Instant expiresAt) {}

    record Account(Profile profile, List<BookingView> bookings, List<OrderView> orders, List<MembershipView> memberships,
                   SelfServicePolicy selfService) {}

    record RescheduleRequest(LocalDate appointmentDate, LocalTime startTime, Long staffId) {}

    record Profile(String email, String name, String phone) {}

    record BookingView(Long id, String serviceName, Integer durationMinutes, BigDecimal price, String currency,
                       String staffName, LocalDate appointmentDate, LocalTime startTime, LocalTime endTime,
                       BookingStatus status, String paymentStatus, String notes, Instant createdAt,
                       boolean canCancel, boolean canReschedule, String blockedReason, Long serviceId, Long staffId) {
        /**
         * @param canCancel / canReschedule whether the customer may do it now, per the salon's policy
         * @param blockedReason why at least one of them isn't available for an upcoming appointment —
         *                      {@code TOO_LATE}, {@code PAID} (cancel only: paid online) or {@code DISABLED} — else null
         */
        static BookingView of(Booking b, ServiceItem service, StaffMember staff, SelfServicePolicy policy) {
            var upcoming = (b.status() == BookingStatus.PENDING || b.status() == BookingStatus.CONFIRMED)
                    && b.appointmentDate() != null && b.startTime() != null
                    && LocalDateTime.of(b.appointmentDate(), b.startTime()).isAfter(LocalDateTime.now());
            var start = upcoming ? LocalDateTime.of(b.appointmentDate(), b.startTime()) : null;
            var now = LocalDateTime.now();
            var cancelInTime = upcoming && !start.isBefore(now.plus(policy.cancelNotice()));
            var rescheduleInTime = upcoming && !start.isBefore(now.plus(policy.rescheduleNotice()));
            var paid = "PAID".equals(b.paymentStatus());
            var canCancel = policy.allowCancel() && cancelInTime && !paid;
            var canReschedule = policy.allowReschedule() && rescheduleInTime;
            String blocked = null;
            if (upcoming && (!canCancel || !canReschedule)) {
                if ((policy.allowCancel() && !cancelInTime) || (policy.allowReschedule() && !rescheduleInTime)) blocked = "TOO_LATE";
                else if (!policy.allowCancel() || !policy.allowReschedule()) blocked = "DISABLED";
                else blocked = "PAID";
            }
            return new BookingView(b.id(),
                    service == null ? null : service.name(),
                    service == null ? null : service.durationMinutes(),
                    service == null ? null : service.price(),
                    service == null ? null : service.currency(),
                    staff == null ? null : staff.name(),
                    b.appointmentDate(), b.startTime(), b.endTime(), b.status(), b.paymentStatus(), b.notes(), b.createdAt(),
                    canCancel, canReschedule, blocked, b.serviceId(), b.staffId());
        }
    }

    record OrderLineView(String productName, String variantLabel, BigDecimal unitPrice, int quantity, BigDecimal lineTotal) {}

    /** {@code message} is the entry's one-line summary; for an email sent to the customer, its subject. */
    record OrderEventView(String type, String message, Instant createdAt) {}

    record OrderView(Long id, String orderNumber, Instant createdAt, OrderStatus status, PaymentStatus paymentStatus,
                     String currency, BigDecimal subtotal, BigDecimal shippingCost, BigDecimal total,
                     String shippingMethodName, ShopOrder.ShippingAddress shippingAddress,
                     String trackingCarrier, String trackingNumber,
                     String refundStatus, BigDecimal refundAmount, String returnStatus,
                     List<OrderLineView> lines, List<OrderEventView> timeline) {
        static OrderView of(ShopOrderHistoryApi.CustomerOrder c) {
            var o = c.order();
            return new OrderView(o.id(), o.orderNumber(), o.createdAt(), o.status(), o.paymentStatus(),
                    o.currency(), o.subtotal(), o.shippingCost(), o.total(),
                    o.shippingMethodName(), o.shippingAddress(), o.trackingCarrier(), o.trackingNumber(),
                    o.refundStatus(), o.refundAmount(), o.returnStatus(),
                    o.lines().stream().map(l -> new OrderLineView(l.productName(), l.variantLabel(), l.unitPrice(),
                            l.quantity(), l.lineTotal())).toList(),
                    c.timeline().stream().map(OrderView::event).toList());
        }

        /** The "SalonSaaS[Salon name] " prefix every customer email subject carries; noise inside the salon's own account. */
        private static final Pattern SUBJECT_PREFIX = Pattern.compile("^SalonSaaS(\\[[^]]*])?\\s*");

        private static OrderEventView event(ShopOrderActivity a) {
            var message = "CUSTOMER_NOTIFIED".equals(a.type()) && a.subject() != null
                    ? SUBJECT_PREFIX.matcher(a.subject()).replaceFirst("")
                    : a.message();
            return new OrderEventView(a.type(), message, a.createdAt());
        }
    }

    record MembershipPaymentView(MembershipPayment.Kind kind, MembershipPayment.Status status, MembershipPayment.Method method,
                                 BigDecimal amount, String currency, Instant periodStart, Instant periodEnd,
                                 Instant paidAt, BigDecimal refundedAmount, Instant createdAt) {}

    /**
     * {@code renewalToken} is the member's own renewal link credential (the one their reminder email
     * carries); present only while the membership can be renewed, so the account can link to it.
     */
    record MembershipView(Long id, String planName, String memberCode, MembershipSubscription.Status status,
                          BigDecimal price, String currency, BillingInterval billingInterval,
                          Instant startedAt, Instant currentPeriodEnd, boolean cancelAtPeriodEnd, Instant endedAt,
                          String renewalToken, String qrCode, List<MembershipPaymentView> payments) {
        static MembershipView of(MembershipSubscription m, List<MembershipPayment> payments, String qrCode) {
            return new MembershipView(m.id(), m.planName(), m.memberCode(), m.status(),
                    m.price(), m.currency(), m.billingInterval(),
                    m.startedAt(), m.currentPeriodEnd(), m.cancelAtPeriodEnd(), m.endedAt(),
                    m.status().renewable() && !m.cancelAtPeriodEnd() ? m.renewalToken() : null,
                    qrCode,
                    payments.stream()
                            // An unpaid checkout the member walked away from isn't a payment to them.
                            .filter(p -> p.status() != MembershipPayment.Status.FAILED)
                            .map(p -> new MembershipPaymentView(p.kind(), p.status(), p.method(), p.amount(), p.currency(),
                                    p.periodStart(), p.periodEnd(), p.paidAt(), p.refundedAmount(), p.createdAt()))
                            .toList());
        }
    }
}
