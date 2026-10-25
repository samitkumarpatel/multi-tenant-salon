package net.samitkumar.multi_tenant_salon.membership.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.membership.BillingInterval;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivatedEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivity;
import net.samitkumar.multi_tenant_salon.membership.MembershipApi;
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
import net.samitkumar.multi_tenant_salon.membership.internal.MembershipViews.SubscriptionPage;
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
class MembershipManager implements MembershipApi {
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
    CheckoutResult sellAtDesk(UUID salonId, DeskSaleSpec spec, String actor) {
        var salon = requireMembershipSalon(salonId);
        if (spec == null) throw badRequest("Choose a plan");
        if (spec.paymentMethod() == null) throw badRequest("Choose how the customer is paying");
        var customer = customer(spec.customerName(), spec.customerEmail(), spec.customerPhone());
        boolean card = spec.paymentMethod() == MembershipPayment.Method.CARD;
        if (card) requireOnlinePayment(salonId);
        // The signed-in person, not the literal "desk": a cash sale taken at the counter has to be
        // traceable to whoever took it when the drawer doesn't add up.
        var by = actor == null || actor.isBlank() ? DESK : actor.strip();
        var started = tx.execute(status -> {
            var s = signUp(salonId, spec.planId(), customer, MembershipSubscription.Source.ADMIN, spec.paymentMethod());
            if (card) {
                activity(s.sub(), MembershipActivity.Type.CHECKOUT_STARTED, (spec.terminalId() == null
                        ? "Card checkout started at the desk for " : "Card reader payment started at the desk for ") + customer.name(), by);
            } else {
                settle(s.payment(), s.sub(), null, by);
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
        var payment = payments.save(MembershipPayment.pending(sub.id(), salonId, MembershipPayment.Kind.SIGNUP,
                method, firstCharge, plan.currency(), now));
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
            // One outstanding renewal at a time. Without this, opening the emailed link in two tabs mints
            // two payable checkouts for the same period and the member can be charged twice for it.
            var outstanding = payments.findFirstBySubscriptionIdAndKindAndStatus(
                    sub.id(), MembershipPayment.Kind.RENEWAL, MembershipPayment.Status.PENDING);
            if (outstanding.isPresent()) return outstanding.get();
            var p = payments.save(MembershipPayment.pending(sub.id(), salonId, MembershipPayment.Kind.RENEWAL,
                    MembershipPayment.Method.CARD, sub.price(), sub.currency(), Instant.now()));
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
        // Two guards on the subscription write, both load-bearing:
        //   · the status list — a payment that lands after the salon cancelled the member (or after an
        //     abandoned checkout was marked INCOMPLETE) must not silently reactivate them and erase the
        //     cancellation reason;
        //   · current_period_end must still be what this payment's period was calculated from, so two
        //     renewals settling at once can't both extend from the same old end and collapse into one
        //     period the member paid for twice.
        int activated = jdbc.sql("""
                UPDATE membership_subscription SET status = 'ACTIVE', started_at = COALESCE(started_at, :now),
                  current_period_end = :end, ended_at = NULL, renewal_reminder_for = NULL,
                  cancel_at_period_end = FALSE, cancelled_at = NULL, cancel_reason = NULL,
                  last_payment_status = 'PAID', last_payment_at = :now, last_payment_amount = :amount
                WHERE id = :id AND status IN ('PENDING_PAYMENT', 'ACTIVE', 'EXPIRED')
                  AND current_period_end IS NOT DISTINCT FROM :expectedEnd""")
                .param("now", ts(now)).param("end", ts(end)).param("amount", payment.amount()).param("id", sub.id())
                .param("expectedEnd", sub.currentPeriodEnd() == null ? null : ts(sub.currentPeriodEnd()))
                .update();
        if (activated != 1) {
            // The payment is already marked PAID, so the money is real but the period was not granted.
            // Leave a timeline entry rather than failing silently: this needs a human (refund, or extend by hand).
            log.warn("[MembershipManager] Paid membership payment id={} sub={} did not apply — subscription moved underneath it",
                    payment.id(), sub.id());
            activity(sub, MembershipActivity.Type.PAYMENT_FAILED,
                    "Payment of " + money(payment.amount(), payment.currency())
                            + " was received but could not be applied — the membership had already changed. Needs review.",
                    actor);
            return;
        }
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
                // The due window is re-asserted here, not just in the SELECT above: a member who renews
                // between the two would otherwise be reminded the day after paying, and the stamp would
                // suppress the genuine reminder for the period they just bought.
                int claimed = jdbc.sql("""
                        UPDATE membership_subscription SET renewal_reminder_for = current_period_end
                        WHERE id = :id AND status = 'ACTIVE' AND renewal_reminder_for IS DISTINCT FROM current_period_end
                          AND current_period_end > :now AND current_period_end <= :until""")
                        .param("id", id).param("now", ts(now))
                        .param("until", ts(now.plus(Duration.ofDays(reminderDays)))).update();
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

    /**
     * Members, filtered and paged in SQL. A busy salon has thousands of these, so the search and the
     * status/plan filters run in the database rather than over every row of the salon loaded into
     * memory, and the status tallies come from one grouped query over the same filter.
     */
    SubscriptionPage listSubscriptions(UUID salonId, SubscriptionFilter filter, int page, int size) {
        int pageIdx = Math.max(0, page);
        int pageSize = Math.min(Math.max(size, 1), 200);

        var where = new StringBuilder("salon_id = :salon");
        var params = new HashMap<String, Object>();
        params.put("salon", salonId);

        if (filter.status() != null) {
            where.append(" AND status = :status");
            params.put("status", filter.status().name());
        }
        if (filter.planId() != null) {
            where.append(" AND plan_id = :plan");
            params.put("plan", filter.planId());
        }
        var term = filter.q() == null ? "" : filter.q().strip();
        if (!term.isEmpty()) {
            var escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
            params.put("q", "%" + escaped + "%");
            // A scanned or typed member code may carry separators and any case; normalize before
            // escaping so a punctuation-only term (e.g. a lone "%") can't normalize away to an
            // empty string and turn member_code ILIKE into a match-everything "%%".
            var normalizedCode = normalizeCode(term);
            if (!normalizedCode.isEmpty()) {
                where.append(" AND (customer_name ILIKE :q OR customer_email ILIKE :q OR member_code ILIKE :code)");
                var escapedCode = normalizedCode.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
                params.put("code", "%" + escapedCode + "%");
            } else {
                where.append(" AND (customer_name ILIKE :q OR customer_email ILIKE :q)");
            }
        }

        // Tallies ignore the status filter, so the chips keep showing what else is there to switch to.
        var countWhere = new StringBuilder("salon_id = :salon");
        var countParams = new HashMap<>(params);
        countParams.remove("status");
        if (filter.planId() != null) countWhere.append(" AND plan_id = :plan");
        if (!term.isEmpty()) {
            countWhere.append(params.containsKey("code")
                    ? " AND (customer_name ILIKE :q OR customer_email ILIKE :q OR member_code ILIKE :code)"
                    : " AND (customer_name ILIKE :q OR customer_email ILIKE :q)");
        }

        var counts = new LinkedHashMap<MembershipSubscription.Status, Long>();
        var countSql = jdbc.sql("SELECT status, count(*) AS n FROM membership_subscription WHERE " + countWhere + " GROUP BY status");
        for (var e : countParams.entrySet()) countSql = countSql.param(e.getKey(), e.getValue());
        countSql.query((rs, n) -> Map.entry(MembershipSubscription.Status.valueOf(rs.getString("status")), rs.getLong("n")))
                .list().forEach(e -> counts.put(e.getKey(), e.getValue()));

        long total = counts.values().stream().mapToLong(Long::longValue).sum();
        if (filter.status() != null) total = counts.getOrDefault(filter.status(), 0L);

        var idSql = jdbc.sql("SELECT id FROM membership_subscription WHERE " + where
                + " ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset");
        for (var e : params.entrySet()) idSql = idSql.param(e.getKey(), e.getValue());
        var ids = idSql.param("limit", pageSize).param("offset", (long) pageIdx * pageSize).query(Long.class).list();

        var byId = subscriptions.findAllById(ids).stream()
                .collect(Collectors.toMap(MembershipSubscription::id, Function.identity()));
        var content = ids.stream().map(byId::get).filter(Objects::nonNull).toList();

        int totalPages = (int) Math.ceil(total / (double) pageSize);
        return new SubscriptionPage(content, pageIdx, pageSize, total, totalPages, counts);
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
            int changed = jdbc.sql("UPDATE membership_subscription SET cancel_at_period_end = TRUE, cancelled_at = :now, cancel_reason = :reason WHERE id = :id AND status = 'ACTIVE'")
                    .param("now", ts(now)).param("reason", note).param("id", id).update();
            // The membership can expire between the read above and this write; emailing the member that
            // their cancellation is scheduled when nothing changed would be a lie.
            if (changed != 1) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "This membership changed while you were cancelling it — reload and try again.");
            }
            activity(sub, MembershipActivity.Type.CANCELLATION_SCHEDULED,
                    "Cancellation scheduled — ends on " + date(sub.currentPeriodEnd()) + suffix, actor);
            publishCancelled(reload(sub), false);
        } else {
            int changed = jdbc.sql("""
                    UPDATE membership_subscription SET status = 'CANCELLED', cancel_at_period_end = FALSE,
                      cancelled_at = :now, ended_at = COALESCE(ended_at, :now), cancel_reason = :reason
                    WHERE id = :id AND status IN ('ACTIVE', 'EXPIRED')""")
                    .param("now", ts(now)).param("reason", note).param("id", id).update();
            if (changed != 1) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "This membership changed while you were cancelling it — reload and try again.");
            }
            activity(sub, MembershipActivity.Type.CANCELLED, "Cancelled immediately" + suffix, actor);
            publishCancelled(reload(sub), true);
        }
        return detail(salonId, id).orElseThrow();
    }

    /**
     * Corrects the member's own contact details. Everything the member ever receives — the welcome mail
     * with their QR code, and the renewal link that is the only way to pay for another period — goes to
     * {@code customer_email}, so a typo taken at the desk otherwise leaves the membership unreachable
     * and unrenewable with no way back. Changing the email also rotates {@code renewal_token}: the link
     * already sent went to the wrong address, and it stays payable until it is replaced.
     */
    @Transactional
    SubscriptionDetail updateContact(UUID salonId, Long id, String name, String email, String phone, String actor) {
        var sub = requireSubscription(salonId, id);
        var updated = customer(name, email, phone);
        boolean emailChanged = !updated.email().equalsIgnoreCase(sub.customerEmail());

        if (emailChanged && sub.status() == MembershipSubscription.Status.ACTIVE) {
            boolean clash = jdbc.sql("""
                    SELECT count(*) FROM membership_subscription
                    WHERE salon_id = :salon AND plan_id = :plan AND lower(customer_email) = lower(:email)
                      AND status = 'ACTIVE' AND id <> :id""")
                    .param("salon", salonId).param("plan", sub.planId()).param("email", updated.email()).param("id", id)
                    .query(Long.class).single() > 0;
            if (clash) {
                throw new ResponseStatusException(HttpStatus.CONFLICT,
                        "That email already has an active membership on this plan.");
            }
        }

        var token = emailChanged ? newToken() : sub.renewalToken();
        jdbc.sql("""
                UPDATE membership_subscription
                SET customer_name = :name, customer_email = :email, customer_phone = :phone, renewal_token = :token
                WHERE id = :id AND salon_id = :salon""")
                .param("name", updated.name()).param("email", updated.email()).param("phone", updated.phone())
                .param("token", token).param("id", id).param("salon", salonId)
                .update();

        var changes = new ArrayList<String>();
        if (!updated.name().equals(sub.customerName())) changes.add("name " + sub.customerName() + " → " + updated.name());
        if (emailChanged) changes.add("email " + sub.customerEmail() + " → " + updated.email());
        if (!Objects.equals(updated.phone(), sub.customerPhone())) {
            changes.add("phone " + (sub.customerPhone() == null ? "—" : sub.customerPhone())
                    + " → " + (updated.phone() == null ? "—" : updated.phone()));
        }
        if (!changes.isEmpty()) {
            activity(sub, MembershipActivity.Type.CONTACT_UPDATED,
                    "Contact details updated: " + String.join(", ", changes)
                            + (emailChanged ? ". The previous renewal link no longer works." : ""),
                    actor);
        }
        return detail(salonId, id).orElseThrow();
    }

    /**
     * Undoes a cancellation. A scheduled one just clears the flag; an immediate one can also be undone
     * while the period the member already paid for is still running — ending a membership by mistake is
     * one click, and without this the only way back was to sell them a whole new membership.
     */
    @Transactional
    SubscriptionDetail resume(UUID salonId, Long id, String actor) {
        var sub = requireSubscription(salonId, id);
        var now = Instant.now();
        boolean stillPaidFor = sub.currentPeriodEnd() != null && sub.currentPeriodEnd().isAfter(now);

        int changed = jdbc.sql("""
                UPDATE membership_subscription SET cancel_at_period_end = FALSE, cancelled_at = NULL, cancel_reason = NULL
                WHERE id = :id AND salon_id = :salon AND status = 'ACTIVE' AND cancel_at_period_end""")
                .param("id", id).param("salon", salonId).update();
        if (changed == 1) {
            activity(sub, MembershipActivity.Type.CANCELLATION_UNDONE, "Cancellation undone — the member can renew again", actor);
            return detail(salonId, id).orElseThrow();
        }

        int reactivated = stillPaidFor ? jdbc.sql("""
                UPDATE membership_subscription SET status = 'ACTIVE', cancel_at_period_end = FALSE,
                  cancelled_at = NULL, cancel_reason = NULL, ended_at = NULL
                WHERE id = :id AND salon_id = :salon AND status = 'CANCELLED' AND current_period_end > :now""")
                .param("id", id).param("salon", salonId).param("now", ts(now)).update() : 0;
        if (reactivated != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "This membership can't be reinstated — the period it was paid for has already ended. Sell a new one instead.");
        }
        activity(sub, MembershipActivity.Type.CANCELLATION_UNDONE,
                "Membership reinstated — still paid for until " + date(sub.currentPeriodEnd()), actor);
        return detail(salonId, id).orElseThrow();
    }

    /**
     * Gives back some or all of one period's charge. Card payments go back to the card through the same
     * gateway the shop uses; cash and other desk payments are handed back at the salon, so those are
     * recorded here as bookkeeping only. Either way the member's Payments panel shows what was returned,
     * because an owner who cannot see that will refund the same period twice.
     */
    @Transactional
    SubscriptionDetail refundPayment(UUID salonId, Long id, Long paymentId, BigDecimal amount, String reason, String actor) {
        var sub = requireSubscription(salonId, id);
        var payment = payments.findById(paymentId)
                .filter(p -> p.salonId().equals(salonId) && p.subscriptionId().equals(id))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Payment not found"));
        if (payment.status() != MembershipPayment.Status.PAID) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Only a paid period can be refunded");
        }
        var left = payment.refundable();
        if (left.signum() <= 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This payment has already been fully refunded");
        }
        var give = amount == null ? left : amount;
        if (give.signum() <= 0) throw badRequest("Refund amount must be greater than zero");
        if (give.compareTo(left) > 0) {
            throw badRequest("That's more than is left to refund on this payment (" + money(left, payment.currency()) + ")");
        }

        boolean byCard = payment.method() == MembershipPayment.Method.CARD;
        var cardRefund = byCard
                ? gateway.refundIfPaid(salonId, PAYMENT_AREA, String.valueOf(paymentId), give, blankToNull(reason), actor)
                : Optional.<PaymentGateway.Refund>empty();
        if (byCard && cardRefund.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No card payment could be found for this period — refund it from your Stripe dashboard instead.");
        }

        var now = Instant.now();
        int changed = jdbc.sql("""
                UPDATE membership_payment
                SET refunded_amount = COALESCE(refunded_amount, 0) + :amount, refunded_at = :now, refund_reason = :reason
                WHERE id = :id AND status = 'PAID' AND COALESCE(refunded_amount, 0) + :amount <= amount""")
                .param("amount", give).param("now", ts(now)).param("reason", blankToNull(reason)).param("id", paymentId)
                .update();
        if (changed != 1) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "That refund no longer fits this payment — reload and try again.");
        }

        var how = byCard ? " to the customer's card" : switch (payment.method()) {
            case CASH -> " in cash at the desk";
            default -> " at the desk";
        };
        activity(sub, MembershipActivity.Type.REFUNDED,
                "Refunded " + money(give, payment.currency()) + how
                        + (blankToNull(reason) == null ? "" : " — " + reason.strip()), actor);
        log.info("[MembershipManager] Refunded {} of payment id={} sub={} salon={} byCard={}",
                give, paymentId, id, salonId, byCard);
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

    @Override
    public List<MembershipSubscription> findByCustomerEmail(UUID salonId, String email) {
        return subscriptions.findByCustomerEmail(salonId, email);
    }

    @Override
    @Transactional
    public int anonymizeCustomer(UUID salonId, String email, String replacementEmail) {
        return subscriptions.anonymizeCustomer(salonId, email, replacementEmail);
    }

    @Override
    public List<MembershipPayment> payments(UUID salonId, Long subscriptionId) {
        return payments.findBySubscriptionIdOrderByCreatedAtDesc(subscriptionId).stream()
                .filter(p -> salonId.equals(p.salonId()))
                .toList();
    }

    /** pgjdbc can't bind java.time.Instant through JdbcClient; OffsetDateTime maps to timestamptz. */
    @Override
    public List<Takings> takings(UUID salonId, Instant from, Instant to) {
        return jdbc.sql("""
                        SELECT currency, method, count(*) AS n, COALESCE(sum(amount), 0) AS total
                        FROM membership_payment
                        WHERE salon_id = :salon AND status = 'PAID' AND paid_at >= :from AND paid_at < :to
                        GROUP BY currency, method ORDER BY currency, method""")
                .param("salon", salonId).param("from", ts(from)).param("to", ts(to))
                .query((rs, i) -> new Takings(rs.getString("currency"), rs.getString("method"),
                        rs.getLong("n"), rs.getBigDecimal("total")))
                .list();
    }

    @Override
    public List<Takings> refunds(UUID salonId, Instant from, Instant to) {
        return jdbc.sql("""
                        SELECT currency, method, count(*) AS n, COALESCE(sum(refunded_amount), 0) AS total
                        FROM membership_payment
                        WHERE salon_id = :salon AND refunded_amount IS NOT NULL
                          AND refunded_at >= :from AND refunded_at < :to
                        GROUP BY currency, method ORDER BY currency, method""")
                .param("salon", salonId).param("from", ts(from)).param("to", ts(to))
                .query((rs, i) -> new Takings(rs.getString("currency"), rs.getString("method"),
                        rs.getLong("n"), rs.getBigDecimal("total")))
                .list();
    }

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
