package net.samitkumar.multi_tenant_salon.membership;

import com.fasterxml.jackson.annotation.JsonValue;
import lombok.Builder;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * A membership plan a salon sells. Perks and included services are child tables rewritten on every
 * save (nothing references their rows). Existing members keep the price/interval they bought —
 * {@link MembershipSubscription} snapshots them — so editing a plan only affects new members, and a
 * plan with members can be archived but never deleted.
 */
@Table("membership_plan")
@Builder(toBuilder = true)
public record MembershipPlan(
        @Id Long id,
        UUID salonId,
        String name,
        String description,
        BigDecimal price,
        String currency,
        BillingInterval billingInterval,
        BigDecimal signupFee,
        Integer serviceDiscountPercent,
        Integer productDiscountPercent,
        /* Cap on members holding the plan at once; null = unlimited. */
        Integer maxMembers,
        boolean highlighted,
        int sortOrder,
        Status status,
        Instant createdAt,
        Instant updatedAt,
        @MappedCollection(idColumn = "plan_id", keyColumn = "sort_key") List<Perk> perks,
        @MappedCollection(idColumn = "plan_id", keyColumn = "sort_key") List<IncludedService> includedServices
) {
    /** DRAFT is admin-only, ACTIVE is on sale, ARCHIVED is off sale but kept for its members. */
    public enum Status { DRAFT, ACTIVE, ARCHIVED }

    public MembershipPlan {
        perks = perks != null ? List.copyOf(perks) : List.of();
        includedServices = includedServices != null ? List.copyOf(includedServices) : List.of();
        if (status == null) status = Status.DRAFT;
    }

    /** One perk line. Serializes as a plain string. */
    @Table("membership_plan_perk")
    public record Perk(@JsonValue String value) {}

    /** A salon service included {@code quantityPerCycle} times every billing period. */
    @Table("membership_plan_service")
    public record IncludedService(Long serviceId, int quantityPerCycle) {}
}
