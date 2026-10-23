package net.samitkumar.multi_tenant_salon.membership.internal;

import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;

import com.fasterxml.jackson.annotation.JsonInclude;
import net.samitkumar.multi_tenant_salon.membership.BillingInterval;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivity;
import net.samitkumar.multi_tenant_salon.membership.MembershipPayment;
import net.samitkumar.multi_tenant_salon.membership.MembershipPlan;
import net.samitkumar.multi_tenant_salon.membership.MembershipSubscription;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.Map;

/** API shapes for the membership endpoints. */
final class MembershipViews {
    private MembershipViews() {}

    /** An included service with its live name/price, so plan cards can show what it's worth. */
    record IncludedServiceView(Long serviceId, String name, Integer durationMinutes, BigDecimal price,
                               String currency, int quantityPerCycle) {}

    /**
     * A plan as shown to admins and the public. {@code includedValue} is the included services'
     * list price per cycle. {@code activeMembers} is admin-only (null on the public catalogue);
     * {@code spotsLeft} is set for capped plans only.
     */
    record PlanView(Long id, String name, String description, BigDecimal price, String currency,
                    BillingInterval billingInterval, BigDecimal signupFee, Integer serviceDiscountPercent,
                    Integer productDiscountPercent, Integer maxMembers, Integer spotsLeft, boolean soldOut,
                    boolean highlighted, int sortOrder, MembershipPlan.Status status, List<String> perks,
                    List<IncludedServiceView> includedServices, BigDecimal includedValue,
                    @JsonInclude(JsonInclude.Include.NON_NULL) Integer activeMembers,
                    Instant createdAt, Instant updatedAt) {}

    /** The public catalogue: plans on sale, and whether visitors can join online right now. */
    record Catalog(List<PlanView> plans, boolean onlineSignup) {}

    /**
     * {@code checkoutUrl}: where to send the customer for a redirect checkout (null otherwise). {@code checkout}:
     * the full instructions, also for an in-page form. {@code terminalPayment}: a card-reader payment at the desk.
     */
    record CheckoutResult(Long subscriptionId, String checkoutUrl, PaymentGateway.Checkout checkout,
                          PaymentGateway.TerminalPayment terminalPayment) {
        static CheckoutResult of(Long subscriptionId, PaymentGateway.Checkout checkout) {
            return new CheckoutResult(subscriptionId, checkout == null ? null : checkout.url(), checkout, null);
        }
    }

    /**
     * What the renewal link shows: whose membership, what the next period costs, and whether it can be
     * paid now ({@code canRenewNow}: expired, or within the renewal window before it ends).
     */
    record RenewalView(Long subscriptionId, String planName, String firstName, BigDecimal price, String currency,
                       BillingInterval billingInterval, MembershipSubscription.Status status, Instant currentPeriodEnd,
                       boolean cancelAtPeriodEnd, boolean canRenewNow, boolean onlinePayment) {}

    record SubscriptionDetail(MembershipSubscription subscription, List<MembershipPayment> payments,
                              List<MembershipActivity> activity) {}

    /**
     * One page of members. {@code statusCounts} deliberately ignores the status filter, so the chips
     * can show how many members sit behind each of the other statuses without a second request.
     */
    record SubscriptionPage(List<MembershipSubscription> content, int page, int size, long totalElements,
                            int totalPages, Map<MembershipSubscription.Status, Long> statusCounts) {}

    record Money(String currency, BigDecimal amount) {}

    /** A timeline entry with the member it belongs to, for the salon-wide activity feed. */
    record ActivityRow(Long id, Long subscriptionId, String customerName, String planName,
                       MembershipActivity.Type type, String message, String actor, Instant createdAt) {}

    record PlanStat(Long planId, String name, MembershipPlan.Status status, int activeMembers,
                    Integer maxMembers, Money monthlyRecurringRevenue) {}

    /**
     * The admin dashboard. Money is per currency (a salon normally has one). "This month" is the
     * current UTC calendar month; renewals count active members whose period ends soon and who aren't
     * set to cancel. {@code expiredMembers} lapsed without renewing and can still renew.
     */
    record Overview(int activeMembers, int expiredMembers, int pendingCheckouts, int newThisMonth,
                    int cancelledThisMonth, int renewalsNext7Days, int renewalsNext30Days,
                    List<Money> monthlyRecurringRevenue, List<Money> collectedThisMonth,
                    List<PlanStat> plans, List<MembershipSubscription> upcomingRenewals,
                    List<ActivityRow> recentActivity) {}
}
