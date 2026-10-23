package net.samitkumar.multi_tenant_salon.membership.internal;

import net.samitkumar.multi_tenant_salon.membership.MembershipActivity;
import net.samitkumar.multi_tenant_salon.membership.MembershipPayment;
import net.samitkumar.multi_tenant_salon.membership.MembershipPlan;
import net.samitkumar.multi_tenant_salon.membership.MembershipSubscription;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

interface MembershipPlanRepository extends ListCrudRepository<MembershipPlan, Long> {
    List<MembershipPlan> findBySalonIdOrderBySortOrderAscIdAsc(UUID salonId);
    Optional<MembershipPlan> findByIdAndSalonId(Long id, UUID salonId);
}

interface MembershipSubscriptionRepository extends ListCrudRepository<MembershipSubscription, Long> {
    List<MembershipSubscription> findBySalonIdOrderByCreatedAtDesc(UUID salonId);
    Optional<MembershipSubscription> findByIdAndSalonId(Long id, UUID salonId);
    Optional<MembershipSubscription> findByRenewalTokenAndSalonId(String renewalToken, UUID salonId);
    Optional<MembershipSubscription> findByMemberCodeAndSalonId(String memberCode, UUID salonId);
    boolean existsByPlanId(Long planId);
    boolean existsByMemberCode(String memberCode);

    @Query("SELECT * FROM membership_subscription WHERE salon_id = :salonId AND lower(customer_email) = lower(:email) AND status <> 'INCOMPLETE' ORDER BY created_at DESC")
    List<MembershipSubscription> findByCustomerEmail(UUID salonId, String email);
}

interface MembershipPaymentRepository extends ListCrudRepository<MembershipPayment, Long> {
    List<MembershipPayment> findBySubscriptionIdOrderByCreatedAtDesc(Long subscriptionId);

    /** The renewal checkout already open for this membership, if any — reused instead of minting a second one. */
    Optional<MembershipPayment> findFirstBySubscriptionIdAndKindAndStatus(
            Long subscriptionId, MembershipPayment.Kind kind, MembershipPayment.Status status);
}

interface MembershipActivityRepository extends ListCrudRepository<MembershipActivity, Long> {
    List<MembershipActivity> findBySubscriptionIdOrderByCreatedAtAsc(Long subscriptionId);
}
