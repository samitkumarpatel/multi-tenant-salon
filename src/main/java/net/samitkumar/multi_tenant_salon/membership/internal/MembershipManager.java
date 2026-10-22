package net.samitkumar.multi_tenant_salon.membership.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.membership.BillingInterval;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivatedEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivity;
import net.samitkumar.multi_tenant_salon.membership.MembershipCancelledEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipCustomerNotifiedEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipPayment;
import net.samitkumar.multi_tenant_salon.membership.MembershipPlan;
import net.samitkumar.multi_tenant_salon.membership.MembershipRenewalDueEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipSubscription;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.ActivityRow;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.Catalog;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.CheckoutResult;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.IncludedServiceView;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.Money;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.Overview;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.PlanStat;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.PlanView;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.RenewalView;
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.SubscriptionDetail;
import net.samitkumar.multi_tenant_salon.payments.PaymentGateway;
import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.salonservice.SalonServiceApi;
import net.samitkumar.multi_tenant_salon.salonservice.ServiceItem;
import net.samitkumar.multi_tenant_salon.utility.QrCodes;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.security.SecureRandom;
import java.time.Duration;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.YearMonth;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Plans, online sign-up and renewal, and the member lifecycle. Payment works like the shop and the
 * till: each billing period is one Stripe Checkout on the salon's connected account (payment area
 * {@code MEMBERSHIP}, reference = the {@link MembershipPayment} id), confirmed by the shared
 * {@code StripePaymentEvent}. Rows are inserted once and then changed only by conditional
 * {@code UPDATE}s, so webhook redeliveries and overlapping scheduler runs are harmless.
 */
@Service
@Slf4j
class MembershipManager {
    static final String PAYMENT_AREA = "MEMBERSHIP";
    /** An unpaid checkout holds a place on a capped plan this long. */
    static final Duration CHECKOUT_HOLD = Duration.ofMinutes(60);
    /** How long before the paid period ends the member may pay for the next one. */
    static final Duration RENEWAL_WINDOW = Duration.ofDays(31);
    /** Advisory-lock class for per-plan sign-up serialization (negative, so it never meets booking's staff ids). */
    private static final int PLAN_LOCK_CLASS = -7301;
    private static final String CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
    private static final Pattern EMAIL = Pattern.compile("^[^@\\s]+@[^@\\s]+\\.[^@\\s]+$");
    private static final DateTimeFormatter DATE = DateTimeFormatter.ofPattern("d MMM yyyy", Locale.ENGLISH).withZone(ZoneOffset.UTC);
    private static final SecureRandom RANDOM = new SecureRandom();
    /** Timeline actor for sales taken at the salon desk. */
    private static final String DESK = "desk";

    record PlanSpec(String name, String description, BigDecimal price, String currency,
                    BillingInterval billingInterval, BigDecimal signupFee, Integer serviceDiscountPercent,
                    Integer productDiscountPercent, Integer maxMembers, Boolean highlighted,
                    MembershipPlan.Status status, List<String> perks,
                    List<MembershipPlan.IncludedService> includedServices) {}

    /** {@code inlineCheckout}: the website can show Stripe's form in the page (see {@link PaymentGateway.CheckoutRequest}). */
    record CheckoutSpec(Long planId, String customerName, String customerEmail, String customerPhone, String returnUrl,
                        Boolean inlineCheckout) {}

    /**
     * A sign-up taken at the salon desk. For {@code CARD}, {@code terminalId} sends the payment to one of the
     * salon's card readers; without it the desk opens a checkout ({@code returnUrl}, {@code inlineCheckout}).
     */
    record DeskSaleSpec(Long planId, String customerName, String customerEmail, String customerPhone,
                        MembershipPayment.Method paymentMethod, String returnUrl, Long terminalId, Boolean inlineCheckout) {}

    record SubscriptionFilter(MembershipSubscription.Status status, Long planId, String q) {}

    private final MembershipPlanRepository plans;
    private final MembershipSubscriptionRepository subscriptions;
    private final MembershipPaymentRepository payments;
    private final MembershipActivityRepository activities;
    private final SalonApi salonApi;
    private final SalonServiceApi serviceApi;
    private final PaymentGateway gateway;
    private final ApplicationEventPublisher events;
    private final JdbcClient jdbc;
    private final TransactionTemplate tx;
    private final int reminderDays;

    MembershipManager(MembershipPlanRepository plans, MembershipSubscriptionRepository subscriptions,
                      MembershipPaymentRepository payments, MembershipActivityRepository activities,
                      SalonApi salonApi, SalonServiceApi serviceApi, PaymentGateway gateway,
                      ApplicationEventPublisher events, JdbcTemplate jdbcTemplate,
                      PlatformTransactionManager transactionManager,
                      @Value("${spring.application.membership.renewal-reminder-days:7}") int reminderDays) {
        this.plans = plans;
        this.subscriptions = subscriptions;
        this.payments = payments;
        this.activities = activities;
        this.salonApi = salonApi;
        this.serviceApi = serviceApi;
        this.gateway = gateway;
        this.events = events;
        this.jdbc = JdbcClient.create(jdbcTemplate);
        this.tx = new TransactionTemplate(transactionManager);
        this.reminderDays = reminderDays;
    }

    // ── Plans (admin) ────────────────────────────────────────────────────────

    List<PlanView> listPlans(UUID salonId) {
        var services = services(salonId);
        var members = currentMembersByPlan(salonId);
        var held = seatsHeldByPlan(salonId);
        return plans.findBySalonIdOrderBySortOrderAscIdAsc(salonId).stream()
                .map(p -> toView(p, services, members.getOrDefault(p.id(), 0), held.getOrDefault(p.id(), 0)))
                .toList();
    }

    Optional<PlanView> getPlan(UUID salonId, Long planId) {
        return plans.findByIdAndSalonId(planId, salonId).map(p -> toView(p, services(salonId),
                currentMembersByPlan(salonId).getOrDefault(p.id(), 0), seatsHeldByPlan(salonId).getOrDefault(p.id(), 0)));
    }

    @Transactional
    PlanView createPlan(UUID salonId, PlanSpec spec) {
        validate(salonId, spec);
        int nextOrder = plans.findBySalonIdOrderBySortOrderAscIdAsc(salonId).stream()
                .mapToInt(MembershipPlan::sortOrder).max().orElse(-1) + 1;
        var now = Instant.now();
        var saved = plans.save(apply(MembershipPlan.builder().salonId(salonId).sortOrder(nextOrder).createdAt(now), spec)
                .updatedAt(now).build());
        return toView(saved, services(salonId), 0, 0);
    }

    @Transactional
    Optional<PlanView> updatePlan(UUID salonId, Long planId, PlanSpec spec) {
        var existing = plans.findByIdAndSalonId(planId, salonId).orElse(null);
        if (existing == null) return Optional.empty();
        validate(salonId, spec);
        plans.save(apply(existing.toBuilder(), spec).updatedAt(Instant.now()).build());
        return getPlan(salonId, planId);
    }

    @Transactional
    boolean deletePlan(UUID salonId, Long planId) {
        var plan = plans.findByIdAndSalonId(planId, salonId).orElse(null);
        if (plan == null) return false;
        if (subscriptions.existsByPlanId(planId)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This plan has members. Archive it instead so existing members keep their membership.");
        }
        plans.delete(plan);
        return true;
    }

    @Transactional
    List<PlanView> reorderPlans(UUID salonId, List<Long> planIds) {
        var order = planIds == null ? List.<Long>of() : List.copyOf(new LinkedHashSet<>(planIds));
        for (int i = 0; i < order.size(); i++) {
            jdbc.sql("UPDATE membership_plan SET sort_order = :order WHERE id = :id AND salon_id = :salon")
                    .param("order", i).param("id", order.get(i)).param("salon", salonId).update();
        }
        return listPlans(salonId);
    }

    private MembershipPlan.MembershipPlanBuilder apply(MembershipPlan.MembershipPlanBuilder builder, PlanSpec spec) {
        var perks = spec.perks() == null ? List.<MembershipPlan.Perk>of() : spec.perks().stream()
                .filter(p -> p != null && !p.isBlank()).map(p -> new MembershipPlan.Perk(p.strip())).toList();
        var included = new LinkedHashMap<Long, MembershipPlan.IncludedService>();
        if (spec.includedServices() != null) {
            spec.includedServices().forEach(s -> included.putIfAbsent(s.serviceId(),
                    new MembershipPlan.IncludedService(s.serviceId(), Math.max(1, s.quantityPerCycle()))));
        }
        return builder.name(spec.name().strip())
                .description(blankToNull(spec.description()))
                .price(spec.price())
                .currency(spec.currency().strip().toUpperCase(Locale.ROOT))
                .billingInterval(spec.billingInterval())
                .signupFee(spec.signupFee() != null && spec.signupFee().signum() > 0 ? spec.signupFee() : null)
                .serviceDiscountPercent(zeroToNull(spec.serviceDiscountPercent()))
                .productDiscountPercent(zeroToNull(spec.productDiscountPercent()))
                .maxMembers(spec.maxMembers())
                .highlighted(Boolean.TRUE.equals(spec.highlighted()))
                .status(spec.status() == null ? MembershipPlan.Status.DRAFT : spec.status())
                .perks(perks)
                .includedServices(List.copyOf(included.values()));
    }

    private void validate(UUID salonId, PlanSpec spec) {
        if (spec == null || spec.name() == null || spec.name().isBlank()) throw badRequest("Plan name is required");
        if (spec.name().strip().length() > 160) throw badRequest("Plan name must be at most 160 characters");
        if (spec.price() == null || spec.price().signum() <= 0) throw badRequest("Price must be greater than zero");
        if (spec.currency() == null || !spec.currency().strip().matches("[A-Za-z]{3}")) throw badRequest("Currency must be a 3-letter code");
        if (spec.billingInterval() == null) throw badRequest("Billing interval is required");
        if (spec.signupFee() != null && spec.signupFee().signum() < 0) throw badRequest("Sign-up fee can't be negative");
        for (var discount : new Integer[]{spec.serviceDiscountPercent(), spec.productDiscountPercent()}) {
            if (discount != null && (discount < 0 || discount > 100)) throw badRequest("Discounts must be between 0 and 100 percent");
        }
        if (spec.maxMembers() != null && spec.maxMembers() < 1) throw badRequest("Member limit must be at least 1, or empty for unlimited");
        if (spec.perks() != null && spec.perks().stream().anyMatch(p -> p != null && p.strip().length() > 300)) {
            throw badRequest("Each perk must be at most 300 characters");
        }
        if (spec.includedServices() != null) {
            for (var s : spec.includedServices()) {
                if (s == null || s.serviceId() == null || serviceApi.findByIdAndSalonId(s.serviceId(), salonId).isEmpty()) {
                    throw badRequest("Included services must be services of this salon");
                }
            }
        }
    }

    // ── Public catalogue, sign-up & renewal ──────────────────────────────────

    Catalog catalog(UUID salonId) {
        requireMembershipSalon(salonId);
        var services = services(salonId);
        var held = seatsHeldByPlan(salonId);
        var onSale = plans.findBySalonIdOrderBySortOrderAscIdAsc(salonId).stream()
                .filter(p -> p.status() == MembershipPlan.Status.ACTIVE)
                .map(p -> toView(p, services, null, held.getOrDefault(p.id(), 0)))
                .toList();
        return new Catalog(onSale, gateway.enabled(salonId, PAYMENT_AREA));
    }

    Optional<PlanView> publicPlan(UUID salonId, Long planId) {
        return catalog(salonId).plans().stream().filter(p -> p.id().equals(planId)).findFirst();
    }

    /**
     * Sign-up, the way the shop places an order: a {@code PENDING_PAYMENT} membership plus a
     * {@code PENDING} payment, then a one-time Stripe Checkout whose reference is that payment's id.
     */
    CheckoutResult startCheckout(UUID salonId, CheckoutSpec spec) {
        var salon = requireMembershipSalon(salonId);
        if (spec == null) throw badRequest("Choose a plan");
        var customer = customer(spec.customerName(), spec.customerEmail(), spec.customerPhone());
        requireOnlinePayment(salonId);
        var started = tx.execute(status -> {
            var s = signUp(salonId, spec.planId(), customer, MembershipSubscription.Source.ONLINE, MembershipPayment.Method.CARD);
            activity(s.sub(), MembershipActivity.Type.CHECKOUT_STARTED, customer.name() + " started checkout for " + s.sub().planName(), "customer");
            return s;
        });
        return CheckoutResult.of(started.sub().id(),
                checkout(salon, started.sub(), started.payment(), spec.returnUrl(), Boolean.TRUE.equals(spec.inlineCheckout())));
    }

    /**
     * A sign-up taken at the salon desk. {@code CARD} is either a card reader payment ({@code terminalId}) or
     * the same one-time Stripe Checkout as online sign-up, opened on the desk and returning there; both settle
     * through the {@code StripePaymentEvent}. {@code CASH}/{@code OTHER} are paid on the spot, so the membership
     * is active (and the QR email queued) before this returns, with no checkout.
     */
    CheckoutResult sellAtDesk(UUID salonId, DeskSaleSpec spec) {
        var salon = requireMembershipSalon(salonId);
        if (spec == null) throw badRequest("Choose a plan");
        if (spec.paymentMethod() == null) throw badRequest("Choose how the customer is paying");
        var customer = customer(spec.customerName(), spec.customerEmail(), spec.customerPhone());
        boolean card = spec.paymentMethod() == MembershipPayment.Method.CARD;
        if (card) requireOnlinePayment(salonId);
        var started = tx.execute(status -> {
            var s = signUp(salonId, spec.planId(), customer, MembershipSubscription.Source.ADMIN, spec.paymentMethod());
            if (card) {
                activity(s.sub(), MembershipActivity.Type.CHECKOUT_STARTED, (spec.terminalId() == null
                        ? "Card checkout started at the desk for " : "Card reader payment started at the desk for ") + customer.name(), DESK);
            } else {
                settle(s.payment(), s.sub(), null, DESK);
            }
            return s;
        });
        if (!card) return CheckoutResult.of(started.sub().id(), null);
        if (spec.terminalId() != null) {
            return new CheckoutResult(started.sub().id(), null, null, onTerminal(salon, started.sub(), started.payment(), spec.terminalId()));
        }
        return CheckoutResult.of(started.sub().id(),
                checkout(salon, started.sub(), started.payment(), spec.returnUrl(), Boolean.TRUE.equals(spec.inlineCheckout())));
    }

    private record Customer(String name, String email, String phone) {}

    private record Started(MembershipSubscription sub, MembershipPayment payment) {}

    private static Customer customer(String name, String email, String phone) {
        var n = name == null ? "" : name.strip();
        var e = email == null ? "" : email.strip();
        if (n.isEmpty()) throw badRequest("Enter your name");
        if (!EMAIL.matcher(e).matches()) throw badRequest("Enter a valid email address");
        return new Customer(n, e, blankToNull(phone));
    }

    /** A {@code PENDING_PAYMENT} membership plus its {@code PENDING} first payment; call inside a transaction. */
    private Started signUp(UUID salonId, Long planId, Customer customer, MembershipSubscription.Source source,
                           MembershipPayment.Method method) {
        if (planId == null) throw badRequest("Choose a plan");
        var plan = plans.findByIdAndSalonId(planId, salonId)
                .filter(p -> p.status() == MembershipPlan.Status.ACTIVE)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership plan not found"));
        // Serialize sign-ups per plan so two visitors can't both take the last place on a capped plan.
        jdbc.sql("SELECT pg_advisory_xact_lock(:cls, :plan)")
                .param("cls", PLAN_LOCK_CLASS).param("plan", plan.id().intValue()).query().singleColumn();
        boolean alreadyMember = jdbc.sql("""
                SELECT count(*) FROM membership_subscription
                WHERE salon_id = :salon AND plan_id = :plan AND lower(customer_email) = lower(:email) AND status = 'ACTIVE'""")
                .param("salon", salonId).param("plan", plan.id()).param("email", customer.email())
                .query(Long.class).single() > 0;
        if (alreadyMember) throw new ResponseStatusException(HttpStatus.CONFLICT, "You're already a member of this plan");
        if (plan.maxMembers() != null && seatsHeldByPlan(salonId).getOrDefault(plan.id(), 0) >= plan.maxMembers()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This plan is full");
        }
        var now = Instant.now();
        var sub = subscriptions.save(MembershipSubscription.builder()
                .salonId(salonId).planId(plan.id()).planName(plan.name()).memberCode(newMemberCode()).renewalToken(newToken())
                .customerName(customer.name()).customerEmail(customer.email()).customerPhone(customer.phone())
                .status(MembershipSubscription.Status.PENDING_PAYMENT)
                .price(plan.price()).currency(plan.currency()).billingInterval(plan.billingInterval())
                .signupFee(plan.signupFee()).source(source)
                .createdAt(now).build());
        var firstCharge = plan.signupFee() == null ? plan.price() : plan.price().add(plan.signupFee());
        var payment = payments.save(new MembershipPayment(null, sub.id(), salonId, MembershipPayment.Kind.SIGNUP,
                MembershipPayment.Status.PENDING, method, firstCharge, plan.currency(), null, null, null, null, now));
        return new Started(sub, payment);
    }

    RenewalView renewal(UUID salonId, String token) {
        requireMembershipSalon(salonId);
        var sub = byToken(salonId, token);
        return new RenewalView(sub.id(), sub.planName(), sub.customerName().split("\\s+")[0], sub.price(), sub.currency(),
                sub.billingInterval(), sub.status(), sub.currentPeriodEnd(), sub.cancelAtPeriodEnd(),
                canRenewNow(sub, Instant.now()), gateway.enabled(salonId, PAYMENT_AREA));
    }

    /** Pays for the next period: a {@code RENEWAL} payment and a one-time checkout, like sign-up. */
    CheckoutResult startRenewal(UUID salonId, String token, String returnUrl, boolean inlineCheckout) {
        var salon = requireMembershipSalon(salonId);
        requireOnlinePayment(salonId);
        var sub = byToken(salonId, token);
        if (!sub.status().renewable()) throw new ResponseStatusException(HttpStatus.CONFLICT, "This membership can't be renewed");
        if (!canRenewNow(sub, Instant.now())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "You're already paid up — renewal opens " + RENEWAL_WINDOW.toDays() + " days before your membership ends");
        }
        var payment = tx.execute(status -> {
            var p = payments.save(new MembershipPayment(null, sub.id(), salonId, MembershipPayment.Kind.RENEWAL,
                    MembershipPayment.Status.PENDING, MembershipPayment.Method.CARD, sub.price(), sub.currency(),
                    null, null, null, null, Instant.now()));
            activity(sub, MembershipActivity.Type.RENEWAL_STARTED, sub.customerName() + " started a renewal checkout", "customer");
            return p;
        });
        return CheckoutResult.of(sub.id(), checkout(salon, sub, payment, returnUrl, inlineCheckout));
    }

    private PaymentGateway.Checkout checkout(Salon salon, MembershipSubscription sub, MembershipPayment payment,
                                             String returnUrl, boolean inlineCheckout) {
        try {
            return gateway.createCheckout(salon.id(), new PaymentGateway.CheckoutRequest(PAYMENT_AREA, String.valueOf(payment.id()),
                    payment.amount(), payment.currency(), sub.planName() + " membership — " + salon.name(), returnUrl,
                    sub.customerEmail(), inlineCheckout));
        } catch (RuntimeException e) {
            tx.executeWithoutResult(status -> recordStripePayment(salon.id(), payment.id(), "checkout-creation-failed", false));
            throw e;
        }
    }

    private PaymentGateway.TerminalPayment onTerminal(Salon salon, MembershipSubscription sub, MembershipPayment payment, Long terminalId) {
        try {
            return gateway.collectOnTerminal(salon.id(), PAYMENT_AREA, String.valueOf(payment.id()), payment.amount(),
                    payment.currency(), sub.planName() + " membership — " + sub.customerName(), terminalId);
        } catch (RuntimeException e) {
            tx.executeWithoutResult(status -> recordStripePayment(salon.id(), payment.id(), "checkout-creation-failed", false));
            throw e;
        }
    }

    private boolean canRenewNow(MembershipSubscription sub, Instant now) {
        return sub.status() == MembershipSubscription.Status.EXPIRED
                || (sub.status() == MembershipSubscription.Status.ACTIVE
                    && (sub.currentPeriodEnd() == null || sub.currentPeriodEnd().isBefore(now.plus(RENEWAL_WINDOW))));
    }

    private void requireOnlinePayment(UUID salonId) {
        if (!gateway.enabled(salonId, PAYMENT_AREA)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Online membership payment isn't available at this salon yet");
        }
    }

    private MembershipSubscription byToken(UUID salonId, String token) {
        return Optional.ofNullable(token).filter(t -> !t.isBlank())
                .flatMap(t -> subscriptions.findByRenewalTokenAndSalonId(t.strip(), salonId))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Renewal link not found"));
    }

    // ── Stripe webhook (StripePaymentEvent, area MEMBERSHIP) ─────────────────

    /**
     * Like the shop's and till's {@code recordStripePayment}: only a {@code PENDING} payment moves. A paid
     * period starts now (or, when renewing early, where the current one ends) and lasts one interval.
     */
    @Transactional
    void recordStripePayment(UUID salonId, Long paymentId, String sessionId, boolean succeeded) {
        var payment = payments.findById(paymentId).filter(p -> p.salonId().equals(salonId)).orElse(null);
        if (payment == null || payment.status() != MembershipPayment.Status.PENDING) return;
        var sub = subscriptions.findByIdAndSalonId(payment.subscriptionId(), salonId).orElse(null);
        if (sub == null) return;
        var now = Instant.now();
        if (!succeeded) {
            int changed = jdbc.sql("UPDATE membership_payment SET status = 'FAILED', checkout_session_id = :session WHERE id = :id AND status = 'PENDING'")
                    .param("session", sessionId).param("id", paymentId).update();
            if (changed != 1) return;
            if (payment.kind() == MembershipPayment.Kind.SIGNUP) {
                markIncomplete(sub, "Checkout expired or the payment failed");
            } else {
                jdbc.sql("UPDATE membership_subscription SET last_payment_status = 'FAILED', last_payment_at = :now WHERE id = :id")
                        .param("now", ts(now)).param("id", sub.id()).update();
                activity(sub, MembershipActivity.Type.PAYMENT_FAILED, "Renewal payment didn't go through — the checkout expired or failed", "stripe");
            }
            return;
        }
        settle(payment, sub, sessionId, "stripe");
    }

    /**
     * Marks a {@code PENDING} payment paid and starts (or extends) the period it buys — now, or where
     * the current one ends when renewing early — for one interval. A no-op if it was already settled.
     */
    private void settle(MembershipPayment payment, MembershipSubscription sub, String sessionId, String actor) {
        var now = Instant.now();
        var start = sub.status() == MembershipSubscription.Status.ACTIVE && sub.currentPeriodEnd() != null
                && sub.currentPeriodEnd().isAfter(now) ? sub.currentPeriodEnd() : now;
        var end = sub.billingInterval().after(start);
        int changed = jdbc.sql("""
                UPDATE membership_payment SET status = 'PAID', checkout_session_id = :session, paid_at = :now,
                  period_start = :start, period_end = :end
                WHERE id = :id AND status = 'PENDING'""")
                .param("session", sessionId).param("now", ts(now)).param("start", ts(start)).param("end", ts(end))
                .param("id", payment.id()).update();
        if (changed != 1) return;
        jdbc.sql("""
                UPDATE membership_subscription SET status = 'ACTIVE', started_at = COALESCE(started_at, :now),
                  current_period_end = :end, ended_at = NULL, renewal_reminder_for = NULL,
                  cancel_at_period_end = FALSE, cancelled_at = NULL, cancel_reason = NULL,
                  last_payment_status = 'PAID', last_payment_at = :now, last_payment_amount = :amount
                WHERE id = :id""")
                .param("now", ts(now)).param("end", ts(end)).param("amount", payment.amount()).param("id", sub.id()).update();
        boolean first = payment.kind() == MembershipPayment.Kind.SIGNUP;
        var paidHow = switch (payment.method()) {
            case CARD -> "";
            case CASH -> " in cash at the desk";
            case OTHER -> " at the desk";
        };
        activity(sub, first ? MembershipActivity.Type.ACTIVATED : MembershipActivity.Type.RENEWED,
                (first ? "Membership activated" : "Membership renewed") + " — paid " + money(payment.amount(), payment.currency())
                        + paidHow + ", member through " + DATE.format(end), actor);
        publishActivated(reload(sub), first ? MembershipActivatedEvent.Kind.WELCOME : MembershipActivatedEvent.Kind.RENEWED);
    }

    private void markIncomplete(MembershipSubscription sub, String reason) {
        int changed = jdbc.sql("UPDATE membership_subscription SET status = 'INCOMPLETE' WHERE id = :id AND status = 'PENDING_PAYMENT'")
                .param("id", sub.id()).update();
        if (changed == 1) activity(sub, MembershipActivity.Type.CHECKOUT_FAILED, reason, "stripe");
    }

    // ── Renewal reminders & expiry (scheduled) ───────────────────────────────

    /**
     * Emails a renewal link to members whose period ends within {@code reminderDays}, and ends
     * memberships whose paid period has run out — {@code CANCELLED} when the salon had scheduled it,
     * otherwise {@code EXPIRED} (with a "renew here" email). Every change is a conditional update, so
     * overlapping runs on several instances send each email once.
     */
    @Scheduled(cron = "${spring.application.membership.renewal-cron:0 */15 * * * *}")
    void processRenewals() {
        processRenewals(Instant.now());
    }

    void processRenewals(Instant now) {
        var dueSoon = jdbc.sql("""
                SELECT id FROM membership_subscription
                WHERE status = 'ACTIVE' AND NOT cancel_at_period_end AND current_period_end > :now AND current_period_end <= :until
                  AND renewal_reminder_for IS DISTINCT FROM current_period_end""")
                .param("now", ts(now)).param("until", ts(now.plus(Duration.ofDays(reminderDays))))
                .query(Long.class).list();
        for (var id : dueSoon) {
            tx.executeWithoutResult(status -> {
                int claimed = jdbc.sql("""
                        UPDATE membership_subscription SET renewal_reminder_for = current_period_end
                        WHERE id = :id AND status = 'ACTIVE' AND renewal_reminder_for IS DISTINCT FROM current_period_end""")
                        .param("id", id).update();
                if (claimed == 1) subscriptions.findById(id).ifPresent(s -> publishRenewalDue(s, false));
            });
        }
        var ran = jdbc.sql("SELECT id FROM membership_subscription WHERE status = 'ACTIVE' AND current_period_end <= :now")
                .param("now", ts(now)).query(Long.class).list();
        for (var id : ran) {
            tx.executeWithoutResult(status -> {
                var sub = subscriptions.findById(id).orElse(null);
                if (sub == null) return;
                int changed = jdbc.sql("""
                        UPDATE membership_subscription
                        SET status = CASE WHEN cancel_at_period_end THEN 'CANCELLED' ELSE 'EXPIRED' END,
                            ended_at = current_period_end
                        WHERE id = :id AND status = 'ACTIVE' AND current_period_end <= :now""")
                        .param("id", id).param("now", ts(now)).update();
                if (changed != 1) return;
                if (sub.cancelAtPeriodEnd()) {
                    activity(sub, MembershipActivity.Type.CANCELLED, "Membership ended — the scheduled cancellation took effect", "system");
                } else {
                    activity(sub, MembershipActivity.Type.EXPIRED, "Paid period ended without a renewal", "system");
                    publishRenewalDue(reload(sub), true);
                }
            });
        }
    }

    // ── Member management (admin) ────────────────────────────────────────────

    List<MembershipSubscription> listSubscriptions(UUID salonId, SubscriptionFilter filter) {
        var q = filter.q() == null ? "" : filter.q().strip().toLowerCase(Locale.ROOT);
        var code = normalizeCode(q);
        return subscriptions.findBySalonIdOrderByCreatedAtDesc(salonId).stream()
                .filter(s -> filter.status() == null || s.status() == filter.status())
                .filter(s -> filter.planId() == null || filter.planId().equals(s.planId()))
                .filter(s -> q.isEmpty()
                        || s.customerName().toLowerCase(Locale.ROOT).contains(q)
                        || s.customerEmail().toLowerCase(Locale.ROOT).contains(q)
                        || (!code.isEmpty() && s.memberCode().contains(code)))
                .toList();
    }

    Optional<SubscriptionDetail> detail(UUID salonId, Long id) {
        return subscriptions.findByIdAndSalonId(id, salonId).map(s -> new SubscriptionDetail(s,
                payments.findBySubscriptionIdOrderByCreatedAtDesc(s.id()),
                activities.findBySubscriptionIdOrderByCreatedAtAsc(s.id())));
    }

    Optional<SubscriptionDetail> verify(UUID salonId, String code) {
        var normalized = normalizeCode(code);
        if (normalized.isEmpty()) return Optional.empty();
        return subscriptions.findByMemberCodeAndSalonId(normalized, salonId).flatMap(s -> detail(salonId, s.id()));
    }

    Optional<byte[]> qrPng(UUID salonId, Long id) {
        return subscriptions.findByIdAndSalonId(id, salonId).map(s -> QrCodes.png(s.memberCode(), 320));
    }

    /**
     * Unsubscribe from the salon side. Nothing renews by itself, so there is nothing to stop in Stripe:
     * at period end the member keeps what they paid for and isn't reminded to renew; immediately ends it now.
     */
    @Transactional
    SubscriptionDetail cancel(UUID salonId, Long id, boolean atPeriodEnd, String reason, String actor) {
        var sub = requireSubscription(salonId, id);
        if (sub.status() == MembershipSubscription.Status.PENDING_PAYMENT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This checkout hasn't been paid yet — it expires on its own");
        }
        if (!sub.status().renewable()) throw new ResponseStatusException(HttpStatus.CONFLICT, "This membership has already ended");
        var note = blankToNull(reason);
        var suffix = note == null ? "" : " — " + note;
        var now = Instant.now();
        if (atPeriodEnd && sub.status() == MembershipSubscription.Status.ACTIVE) {
            if (sub.cancelAtPeriodEnd()) return detail(salonId, id).orElseThrow();
            jdbc.sql("UPDATE membership_subscription SET cancel_at_period_end = TRUE, cancelled_at = :now, cancel_reason = :reason WHERE id = :id AND status = 'ACTIVE'")
                    .param("now", ts(now)).param("reason", note).param("id", id).update();
            activity(sub, MembershipActivity.Type.CANCELLATION_SCHEDULED,
                    "Cancellation scheduled — ends on " + date(sub.currentPeriodEnd()) + suffix, actor);
            publishCancelled(reload(sub), false);
        } else {
            jdbc.sql("""
                    UPDATE membership_subscription SET status = 'CANCELLED', cancel_at_period_end = FALSE,
                      cancelled_at = :now, ended_at = COALESCE(ended_at, :now), cancel_reason = :reason
                    WHERE id = :id AND status IN ('ACTIVE', 'EXPIRED')""")
                    .param("now", ts(now)).param("reason", note).param("id", id).update();
            activity(sub, MembershipActivity.Type.CANCELLED, "Cancelled immediately" + suffix, actor);
            publishCancelled(reload(sub), true);
        }
        return detail(salonId, id).orElseThrow();
    }

    @Transactional
    SubscriptionDetail resume(UUID salonId, Long id, String actor) {
        var sub = requireSubscription(salonId, id);
        int changed = jdbc.sql("""
                UPDATE membership_subscription SET cancel_at_period_end = FALSE, cancelled_at = NULL, cancel_reason = NULL
                WHERE id = :id AND salon_id = :salon AND status = 'ACTIVE' AND cancel_at_period_end""")
                .param("id", id).param("salon", salonId).update();
        if (changed != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a membership set to cancel at period end can be resumed");
        }
        activity(sub, MembershipActivity.Type.CANCELLATION_UNDONE, "Cancellation undone — the member can renew again", actor);
        return detail(salonId, id).orElseThrow();
    }

    @Transactional
    SubscriptionDetail addNote(UUID salonId, Long id, String note, String actor) {
        var sub = requireSubscription(salonId, id);
        if (note == null || note.isBlank()) throw badRequest("Note can't be empty");
        activity(sub, MembershipActivity.Type.NOTE, note.strip(), actor);
        return detail(salonId, id).orElseThrow();
    }

    @Transactional
    SubscriptionDetail resendWelcome(UUID salonId, Long id) {
        var sub = requireSubscription(salonId, id);
        if (!sub.status().current()) throw new ResponseStatusException(HttpStatus.CONFLICT, "Only current members can be sent their QR code");
        publishActivated(sub, MembershipActivatedEvent.Kind.RESEND);
        return detail(salonId, id).orElseThrow();
    }

    @Transactional
    SubscriptionDetail sendRenewalLink(UUID salonId, Long id) {
        var sub = requireSubscription(salonId, id);
        if (!sub.status().renewable() || sub.cancelAtPeriodEnd()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only active or expired memberships that aren't cancelled can be renewed");
        }
        publishRenewalDue(sub, sub.status() == MembershipSubscription.Status.EXPIRED);
        return detail(salonId, id).orElseThrow();
    }

    @Transactional
    void recordCustomerNotification(MembershipCustomerNotifiedEvent event) {
        var sub = subscriptions.findByIdAndSalonId(event.subscriptionId(), event.salonId()).orElse(null);
        if (sub == null) return;
        var outcome = "FAILED".equals(event.status()) ? "Email could not be sent to " : "Email sent to ";
        activity(sub, MembershipActivity.Type.CUSTOMER_NOTIFIED, outcome + event.recipient() + ": " + event.subject(), "system");
    }

    // ── Overview (admin) ─────────────────────────────────────────────────────

    Overview overview(UUID salonId) {
        var all = subscriptions.findBySalonIdOrderByCreatedAtDesc(salonId);
        var now = Instant.now();
        var monthStart = YearMonth.now(ZoneOffset.UTC).atDay(1).atStartOfDay().toInstant(ZoneOffset.UTC);
        var current = all.stream().filter(s -> s.status().current()).toList();
        var renewing = current.stream()
                .filter(s -> !s.cancelAtPeriodEnd() && s.currentPeriodEnd() != null && !s.currentPeriodEnd().isBefore(now))
                .sorted(Comparator.comparing(MembershipSubscription::currentPeriodEnd)).toList();
        Function<Duration, Integer> renewalsWithin = d -> (int) renewing.stream()
                .filter(s -> s.currentPeriodEnd().isBefore(now.plus(d))).count();

        var mrr = sumByCurrency(current.stream().filter(s -> !s.cancelAtPeriodEnd())
                .map(s -> new Money(s.currency(), s.billingInterval().monthly(s.price()))).toList());
        var collected = sumByCurrency(jdbc.sql("""
                SELECT currency, COALESCE(SUM(amount), 0) AS amount FROM membership_payment
                WHERE salon_id = :salon AND status = 'PAID' AND paid_at >= :from GROUP BY currency""")
                .param("salon", salonId).param("from", ts(monthStart))
                .query((rs, n) -> new Money(rs.getString("currency"), rs.getBigDecimal("amount"))).list());

        var planStats = plans.findBySalonIdOrderBySortOrderAscIdAsc(salonId).stream().map(p -> {
            var members = current.stream().filter(s -> p.id().equals(s.planId())).toList();
            var planMrr = members.stream().filter(s -> !s.cancelAtPeriodEnd())
                    .map(s -> s.billingInterval().monthly(s.price())).reduce(BigDecimal.ZERO, BigDecimal::add);
            return new PlanStat(p.id(), p.name(), p.status(), members.size(), p.maxMembers(), new Money(p.currency(), planMrr));
        }).toList();

        var recent = jdbc.sql("""
                SELECT a.id, a.subscription_id, s.customer_name, s.plan_name, a.type, a.message, a.actor, a.created_at
                FROM membership_activity a JOIN membership_subscription s ON s.id = a.subscription_id
                WHERE a.salon_id = :salon ORDER BY a.created_at DESC, a.id DESC LIMIT 15""")
                .param("salon", salonId)
                .query((rs, n) -> new ActivityRow(rs.getLong("id"), rs.getLong("subscription_id"),
                        rs.getString("customer_name"), rs.getString("plan_name"),
                        MembershipActivity.Type.valueOf(rs.getString("type")), rs.getString("message"), rs.getString("actor"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant()))
                .list();

        return new Overview(
                current.size(),
                (int) all.stream().filter(s -> s.status() == MembershipSubscription.Status.EXPIRED).count(),
                (int) all.stream().filter(s -> s.status() == MembershipSubscription.Status.PENDING_PAYMENT).count(),
                (int) all.stream().filter(s -> s.startedAt() != null && !s.startedAt().isBefore(monthStart)).count(),
                (int) all.stream().filter(s -> s.status() == MembershipSubscription.Status.CANCELLED
                        && s.endedAt() != null && !s.endedAt().isBefore(monthStart)).count(),
                renewalsWithin.apply(Duration.ofDays(7)), renewalsWithin.apply(Duration.ofDays(30)),
                mrr, collected, planStats, renewing.stream().limit(10).toList(), recent);
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private PlanView toView(MembershipPlan plan, Map<Long, ServiceItem> services, Integer activeMembers, int seatsHeld) {
        var included = plan.includedServices().stream()
                .map(i -> {
                    var s = services.get(i.serviceId());
                    return s == null ? null : new IncludedServiceView(s.id(), s.name(), s.durationMinutes(), s.price(),
                            s.currency(), i.quantityPerCycle());
                })
                .filter(Objects::nonNull).toList();
        var priced = included.stream()
                .filter(i -> i.price() != null && plan.currency().equalsIgnoreCase(i.currency() == null ? plan.currency() : i.currency()))
                .toList();
        var includedValue = priced.isEmpty() ? null : priced.stream()
                .map(i -> i.price().multiply(BigDecimal.valueOf(i.quantityPerCycle()))).reduce(BigDecimal.ZERO, BigDecimal::add);
        Integer spotsLeft = plan.maxMembers() == null ? null : Math.max(0, plan.maxMembers() - seatsHeld);
        return new PlanView(plan.id(), plan.name(), plan.description(), plan.price(), plan.currency(), plan.billingInterval(),
                plan.signupFee(), plan.serviceDiscountPercent(), plan.productDiscountPercent(), plan.maxMembers(), spotsLeft,
                spotsLeft != null && spotsLeft == 0, plan.highlighted(), plan.sortOrder(), plan.status(),
                plan.perks().stream().map(MembershipPlan.Perk::value).toList(), included, includedValue,
                activeMembers, plan.createdAt(), plan.updatedAt());
    }

    private Map<Long, ServiceItem> services(UUID salonId) {
        return serviceApi.findAllBySalonId(salonId).stream().collect(Collectors.toMap(ServiceItem::id, s -> s, (a, b) -> a));
    }

    private Map<Long, Integer> currentMembersByPlan(UUID salonId) {
        return countByPlan(salonId, "status = 'ACTIVE'", null);
    }

    /** Current members plus checkouts still within their hold — what counts against a plan's cap. */
    private Map<Long, Integer> seatsHeldByPlan(UUID salonId) {
        return countByPlan(salonId, "(status = 'ACTIVE' OR (status = 'PENDING_PAYMENT' AND created_at > :since))",
                Instant.now().minus(CHECKOUT_HOLD));
    }

    private Map<Long, Integer> countByPlan(UUID salonId, String condition, Instant since) {
        var sql = jdbc.sql("SELECT plan_id, count(*) AS n FROM membership_subscription WHERE salon_id = :salon AND "
                + condition + " GROUP BY plan_id").param("salon", salonId);
        if (since != null) sql = sql.param("since", ts(since));
        var counts = new HashMap<Long, Integer>();
        sql.query((rs, n) -> Map.entry(rs.getLong("plan_id"), rs.getInt("n"))).list()
                .forEach(e -> counts.put(e.getKey(), e.getValue()));
        return counts;
    }

    private void publishActivated(MembershipSubscription sub, MembershipActivatedEvent.Kind kind) {
        var contact = salonContact(sub.salonId());
        var perks = plans.findById(sub.planId()).map(p -> p.perks().stream().map(MembershipPlan.Perk::value).toList()).orElse(List.of());
        events.publishEvent(new MembershipActivatedEvent(sub.id(), sub.salonId(), sub.memberCode(), sub.customerName(),
                sub.customerEmail(), sub.planName(), sub.price(), sub.currency(), sub.billingInterval(), sub.currentPeriodEnd(),
                perks, contact.name(), contact.phone(), contact.email(), kind));
    }

    private void publishRenewalDue(MembershipSubscription sub, boolean expired) {
        var contact = salonContact(sub.salonId());
        var handler = salonApi.findById(sub.salonId()).map(Salon::handler).orElse(null);
        events.publishEvent(new MembershipRenewalDueEvent(sub.id(), sub.salonId(), sub.memberCode(), sub.customerName(),
                sub.customerEmail(), sub.planName(), sub.price(), sub.currency(), sub.billingInterval(), sub.currentPeriodEnd(),
                expired, sub.renewalToken(), handler, contact.name(), contact.phone(), contact.email()));
    }

    private void publishCancelled(MembershipSubscription sub, boolean immediate) {
        var contact = salonContact(sub.salonId());
        events.publishEvent(new MembershipCancelledEvent(sub.id(), sub.salonId(), sub.memberCode(), sub.customerName(),
                sub.customerEmail(), sub.planName(), immediate || sub.currentPeriodEnd() == null ? Instant.now() : sub.currentPeriodEnd(),
                immediate, contact.name(), contact.phone(), contact.email()));
    }

    private record SalonContact(String name, String phone, String email) {}

    private SalonContact salonContact(UUID salonId) {
        return salonApi.findById(salonId)
                .map(s -> new SalonContact(s.name(), s.contact() != null ? s.contact().phone() : null,
                        s.contact() != null ? s.contact().email() : null))
                .orElse(new SalonContact(null, null, null));
    }

    private Salon requireMembershipSalon(UUID salonId) {
        return salonApi.findById(salonId)
                .filter(s -> s.status() == Salon.SalonStatus.ACTIVE)
                .filter(s -> s.features().stream().anyMatch(f -> f.feature() == SalonFeature.MEMBERSHIP))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Memberships are not available for this salon"));
    }

    private MembershipSubscription requireSubscription(UUID salonId, Long id) {
        return subscriptions.findByIdAndSalonId(id, salonId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Membership not found"));
    }

    private MembershipSubscription reload(MembershipSubscription sub) {
        return subscriptions.findById(sub.id()).orElse(sub);
    }

    private void activity(MembershipSubscription sub, MembershipActivity.Type type, String message, String actor) {
        activities.save(new MembershipActivity(null, sub.id(), sub.salonId(), type, message,
                actor == null || actor.isBlank() ? "admin" : actor, Instant.now()));
    }

    private String newMemberCode() {
        for (int attempt = 0; ; attempt++) {
            var code = new StringBuilder("M");
            for (int i = 0; i < 8; i++) code.append(CODE_ALPHABET.charAt(RANDOM.nextInt(CODE_ALPHABET.length())));
            if (attempt > 5 || !subscriptions.existsByMemberCode(code.toString())) return code.toString();
        }
    }

    private static String newToken() {
        var bytes = new byte[24];
        RANDOM.nextBytes(bytes);
        return java.util.Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    /** What a scanner or a person typed → the stored form: upper-case letters and digits only. */
    static String normalizeCode(String code) {
        return code == null ? "" : code.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    private static List<Money> sumByCurrency(List<Money> amounts) {
        var totals = new LinkedHashMap<String, BigDecimal>();
        amounts.forEach(m -> totals.merge(m.currency(), m.amount() == null ? BigDecimal.ZERO : m.amount(), BigDecimal::add));
        var result = new ArrayList<Money>();
        totals.forEach((currency, amount) -> result.add(new Money(currency, amount)));
        return result;
    }

    private static String money(BigDecimal amount, String currency) {
        return (amount == null ? "0" : amount.setScale(2, java.math.RoundingMode.HALF_UP).toPlainString()) + " " + currency;
    }

    private static String date(Instant instant) {
        return instant == null ? "the end of the current period" : DATE.format(instant);
    }

    /** pgjdbc can't bind java.time.Instant through JdbcClient; OffsetDateTime maps to timestamptz. */
    private static OffsetDateTime ts(Instant instant) {
        return instant == null ? null : instant.atOffset(ZoneOffset.UTC);
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.strip();
    }

    private static Integer zeroToNull(Integer value) {
        return value == null || value == 0 ? null : value;
    }

    private static ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
