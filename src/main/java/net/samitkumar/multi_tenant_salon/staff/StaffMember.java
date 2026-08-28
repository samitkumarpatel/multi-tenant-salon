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
        @Column("profile_photo_url") String photoUrl,
        String bio,
        @MappedCollection(idColumn = "staff_member_id") List<Specialization> specializations,
        @MappedCollection(idColumn = "staff_member_id") List<PhotoUrl> photoUrls,
        Instant createdAt
) {
    public StaffMember {
        specializations = specializations != null ? List.copyOf(specializations) : List.of();
        photoUrls = photoUrls != null ? List.copyOf(photoUrls) : List.of();
    }

    @Table("staff_member_specialization")
    public record Specialization(@JsonValue String value) {}

    /** A single image or video URL of the staff member's work. Serializes as a plain string. */
    @Table("staff_member_photo")
    public record PhotoUrl(@JsonValue String value) {}
}
