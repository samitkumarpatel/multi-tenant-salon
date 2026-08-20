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

    public record ContactInfo(
            @Column("contact_phone") String phone,
            @Column("contact_email") String email,
            @Column("contact_website") String website
    ) {}

    @Table("salon_operating_hours")
    public record OperatingHours(DayOfWeek day, String openTime, String closeTime, boolean closed) {}

    @Table("salon_feature")
    public record SalonFeatureRef(@JsonValue SalonFeature feature) {}
}
