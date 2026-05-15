package net.samitkumar.multi_tenant_saloon.saloon;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.DayOfWeek;
import java.time.Instant;
import java.util.List;

@Document(collection = "saloons")
public record Saloon(
        @Id String id,
        String name,
        Owner owner,
        Location location,
        ContactInfo contact,
        List<OperatingHours> operatingHours,
        List<SaloonFeature> features,
        Instant createdAt
) {
    public Saloon {
        features = features != null ? List.copyOf(features) : List.of();
        operatingHours = operatingHours != null ? List.copyOf(operatingHours) : List.of();
    }

    public record Owner(String name, String email, String phone) {}

    public record Location(String address, String city, String state, String country, String zipCode) {}

    public record ContactInfo(String phone, String email, String website) {}

    public record OperatingHours(DayOfWeek day, String openTime, String closeTime, boolean closed) {}
}
