package net.samitkumar.multi_tenant_salon.loyalty;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

/** What one customer sees of a salon's loyalty programme: balance, rules, rewards, history and codes. */
public record CustomerLoyalty(boolean enabled, int balance, Program program, List<Reward> rewards,
                              List<Entry> history, List<Redemption> redemptions) {

    public record Program(boolean enabled, BigDecimal pointsPerUnit, boolean earnOnBookings, boolean earnOnOrders,
                          Integer expiryMonths) {}

    public record Reward(Long id, String name, String description, int pointsCost, String type, BigDecimal value,
                         boolean active) {}

    public record Entry(Long id, int delta, String reason, String note, Instant createdAt, Instant expiresAt) {}

    public record Redemption(Long id, String rewardName, int points, String code, String status, Instant createdAt,
                             Instant usedAt) {}
}
