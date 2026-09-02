package net.samitkumar.multi_tenant_salon.salon;

import com.fasterxml.jackson.annotation.JsonValue;
import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
import org.springframework.data.relational.core.mapping.Embedded;
import org.springframework.data.relational.core.mapping.MappedCollection;
import org.springframework.data.relational.core.mapping.Table;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Table("salon")
public record Salon(
        @Id UUID id,
        String name,
        String handler,
        @Embedded(onEmpty = Embedded.OnEmpty.USE_NULL) Owner owner,
        @Embedded(onEmpty = Embedded.OnEmpty.USE_NULL) Location location,
        @Embedded(onEmpty = Embedded.OnEmpty.USE_NULL) ContactInfo contact,
        @MappedCollection(idColumn = "salon_id", keyColumn = "salon_key") List<OperatingHours> operatingHours,
        @MappedCollection(idColumn = "salon_id", keyColumn = "salon_key") List<SalonFeatureRef> features,
        Integer bookingAdvanceDays,
        String businessRegistrationId,
        Boolean showBusinessId,
        Boolean bookingRequiresConfirmation,
        String businessIdLabel,
        Instant createdAt,
        SalonStatus status,
        Boolean termsAccepted,
        Instant termsAcceptedAt
) {
    public enum SalonStatus { ACTIVE, DISABLED }

    public Salon {
        features = features != null ? List.copyOf(features) : List.of();
        operatingHours = operatingHours != null ? List.copyOf(operatingHours) : List.of();
        if (bookingAdvanceDays == null) bookingAdvanceDays = 60;
        if (showBusinessId == null) showBusinessId = false;
        if (bookingRequiresConfirmation == null) bookingRequiresConfirmation = false;
        if (status == null) status = SalonStatus.ACTIVE;
        if (termsAccepted == null) termsAccepted = false;
    }

    public record Owner(
            @Column("owner_name") String name,
            @Column("owner_email") String email,
            @Column("owner_phone") String phone
    ) {}

    public record Location(String address, String city, String state, String country, String zipCode) {}

    /**
     * Phone/email/website plus the salon's social profiles. Each social platform carries its URL
     * and an independent {@code *Visible} flag — the owner opts a platform into the public website
     * footer per-platform; a visible platform with no URL yet renders as a disabled icon.
     */
    public record ContactInfo(
            @Column("contact_phone") String phone,
            @Column("contact_email") String email,
            @Column("contact_website") String website,
            @Column("contact_facebook") String facebook,
            @Column("contact_facebook_visible") Boolean facebookVisible,
            @Column("contact_instagram") String instagram,
            @Column("contact_instagram_visible") Boolean instagramVisible,
            @Column("contact_tiktok") String tiktok,
            @Column("contact_tiktok_visible") Boolean tiktokVisible,
            @Column("contact_youtube") String youtube,
            @Column("contact_youtube_visible") Boolean youtubeVisible,
            @Column("contact_x") String x,
            @Column("contact_x_visible") Boolean xVisible
    ) {}

    @Table("salon_operating_hours")
    public record OperatingHours(DayOfWeek day, String openTime, String closeTime, boolean closed) {}

    @Table("salon_feature")
    public record SalonFeatureRef(@JsonValue SalonFeature feature) {}
}
