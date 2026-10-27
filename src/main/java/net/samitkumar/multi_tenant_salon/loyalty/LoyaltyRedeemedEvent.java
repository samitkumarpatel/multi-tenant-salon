package net.samitkumar.multi_tenant_salon.loyalty;

import java.util.UUID;

/** Published when a customer redeems points — drives the email carrying the redemption code. */
public record LoyaltyRedeemedEvent(Long redemptionId, UUID salonId, String customerEmail, String rewardName,
                                   String code, int points, int balanceAfter,
                                   String salonName, String salonPhone, String salonEmail) {}
