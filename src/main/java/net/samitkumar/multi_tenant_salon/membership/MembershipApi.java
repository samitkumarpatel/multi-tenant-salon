package net.samitkumar.multi_tenant_salon.membership;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * What other modules may ask the membership module. The salon desk's end-of-day report needs the money
 * taken for memberships — a cash membership sold at the counter never touches the till's own sales —
 * without reaching into membership's tables.
 */
public interface MembershipApi {

    /** Membership payments settled in {@code [from, to)}, by currency and how they were paid. */
    List<Takings> takings(UUID salonId, Instant from, Instant to);

    /** Money given back on membership payments in {@code [from, to)}, by currency and how it was paid. */
    List<Takings> refunds(UUID salonId, Instant from, Instant to);

    /**
     * Every membership the salon holds under {@code email} (matched case-insensitively), newest first —
     * abandoned first checkouts ({@code INCOMPLETE}) left out, since they never became a membership.
     */
    List<MembershipSubscription> findByCustomerEmail(UUID salonId, String email);

    /**
     * Erases a customer's personal details from every membership the salon holds under {@code email}
     * (matched case-insensitively): name and phone are blanked and the email replaced. Plans, periods
     * and payments stay for the salon's books.
     *
     * @return how many memberships were rewritten
     */
    int anonymizeCustomer(UUID salonId, String email, String replacementEmail);

    /** The payments for one of the salon's memberships, newest first. */
    List<MembershipPayment> payments(UUID salonId, Long subscriptionId);

    /** The perks an active member can use at the counter, or empty when the email holds no active membership. */
    java.util.Optional<MemberBenefits> benefitsFor(UUID salonId, String email);

    /**
     * Prices a till cart for an active member: included services that still have allowance this cycle are free,
     * the rest of the services and the products get the plan's discount percentages. Takes a per-member lock held until
     * the caller's transaction ends, so two sales cannot spend the same allowance. Nothing is recorded until
     * {@link #recordSaleUse}. Empty when the email holds no active membership.
     */
    java.util.Optional<SalePricing> priceSale(UUID salonId, String email, List<SaleLine> lines);

    /** Spends the allowance {@link #priceSale} granted, tied to the sale so a void can give it back. */
    void recordSaleUse(UUID salonId, Long saleId, SalePricing pricing);

    /** Gives back the included services a sale used (it was voided or failed). A no-op when it used none. */
    void releaseSaleUse(UUID salonId, Long saleId);

    record MemberBenefits(Long subscriptionId, String planName, Integer serviceDiscountPercent, Integer productDiscountPercent,
                          Instant cycleEnd, List<Included> included) {}

    record Included(Long serviceId, int perCycle, int remaining) {}

    /** One till line: {@code service} true for a salon service, false for a shop product. */
    record SaleLine(boolean service, Long itemId, BigDecimal unitPrice, int quantity) {}

    record Use(Long serviceId, int quantity) {}

    /** {@code discount} is the total money off the cart; {@code summary} says why, for the receipt. */
    record SalePricing(Long subscriptionId, String planName, Instant cycleEnd, BigDecimal discount, String summary, List<Use> uses) {}

    /** @param method {@code CARD}, {@code CASH} or {@code OTHER} — how the original payment was made */
    record Takings(String currency, String method, long count, BigDecimal total) {}
}
