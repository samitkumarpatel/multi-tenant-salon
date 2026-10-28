package net.samitkumar.multi_tenant_salon.loyalty;

import java.math.BigDecimal;

/** A loyalty reward code spent at the counter as money off the sale. */
public record CounterReward(Long redemptionId, String rewardName, BigDecimal discount, String customerEmail) {}
