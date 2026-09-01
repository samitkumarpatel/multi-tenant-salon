package net.samitkumar.multi_tenant_salon.staff;

import com.fasterxml.jackson.annotation.JsonValue;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Table("staff_member")
public record StaffMember(
        @Id Long id,
        UUID salonId,
        String name,
        String email,
        String phone,
        StaffRole role,
        StaffStatus status,
        @Column("is_owner") boolean isOwner,
        @Column("available_for_booking") boolean availableForBooking,
        // JSON: "avatarUrl". DB column keeps its original name, mapped here.
        @Column("profile_photo_url") String avatarUrl,
        String bio,
        @MappedCollection(idColumn = "staff_member_id") List<Specialization> specializations,
        // JSON: "workMedia" — the staff member's portfolio images/videos. DB table keeps its
        // original name (staff_member_photo), mapped on WorkMedia below.
        @MappedCollection(idColumn = "staff_member_id") List<WorkMedia> workMedia,
        Instant createdAt
) {
    public StaffMember {
        specializations = specializations != null ? List.copyOf(specializations) : List.of();
        workMedia = workMedia != null ? List.copyOf(workMedia) : List.of();
    }

    @Table("staff_member_specialization")
    public record Specialization(@JsonValue String value) {}

    /** A single image or video URL of the staff member's work. Serializes as a plain string. */
    @Table("staff_member_photo")
    public record WorkMedia(@JsonValue String value) {}
}
