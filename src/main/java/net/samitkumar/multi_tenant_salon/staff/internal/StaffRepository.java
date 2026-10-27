package net.samitkumar.multi_tenant_salon.staff.internal;

import net.samitkumar.multi_tenant_salon.staff.StaffMember;
import org.springframework.data.jdbc.repository.query.Modifying;
import org.springframework.data.jdbc.repository.query.Query;
import org.springframework.data.repository.ListCrudRepository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.UUID;

interface StaffRepository extends ListCrudRepository<StaffMember, Long> {
    List<StaffMember> findBySalonId(UUID salonId);
    List<StaffMember> findBySalonIdAndAvailableForBookingTrue(UUID salonId);
    List<StaffMember> findByEmail(String email);
    @Query("SELECT sm.* FROM staff_member sm JOIN salon s ON s.id = sm.salon_id WHERE lower(btrim(sm.email)) = :email AND s.status = 'ACTIVE'")
    List<StaffMember> findByCanonicalEmail(String email);

    /** A targeted update, so recolouring never rewrites the profile's child rows. */
    @Modifying
    @Query("UPDATE staff_member SET calendar_color = :color WHERE id = :id AND salon_id = :salonId")
    int updateCalendarColor(@Param("id") Long id, @Param("salonId") UUID salonId, @Param("color") String color);
}
