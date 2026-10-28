package net.samitkumar.multi_tenant_salon.loyalty;

import java.util.UUID;

public interface LoyaltyApi {
    /** The customer's balance, history and redeemable rewards; {@code enabled=false} (and no data) when the salon runs no programme. */
    CustomerLoyalty forCustomer(UUID salonId, String customerEmail);

    /**
     * Spends points on a reward and issues a redemption code. Serialized per customer, so concurrent
     * redemptions cannot overspend.
     *
     * @throws org.springframework.web.server.ResponseStatusException 404 unknown/inactive reward, 409 programme off or not enough points
     */
    CustomerLoyalty.Redemption redeem(UUID salonId, String customerEmail, Long rewardId);

    /**
     * Spends an issued {@code DISCOUNT_AMOUNT} reward code at the till and returns the money off. Conditional on
     * {@code ISSUED}, so the same code cannot be used twice.
     *
     * @throws org.springframework.web.server.ResponseStatusException 404 unknown code, 409 already used/cancelled or a reward that is handed over by hand
     */
    CounterReward useAtCounter(UUID salonId, String code, String actor);

    /** Puts a code spent by {@link #useAtCounter} back to {@code ISSUED} (the sale failed or was voided). A no-op if it is not {@code USED}. */
    void reopenCounterReward(UUID salonId, Long redemptionId);

    /** Rewrites every loyalty row held under {@code email} to {@code replacementEmail}; returns how many rows changed. */
    int anonymizeCustomer(UUID salonId, String email, String replacementEmail);

    /**
     * Expires every earn whose time has passed and whose points are still unspent (oldest points are spent first).
     * Runs on a schedule; safe to run again — one row per earn.
     *
     * @return how many earns were expired
     */
    int expireDue();
}
