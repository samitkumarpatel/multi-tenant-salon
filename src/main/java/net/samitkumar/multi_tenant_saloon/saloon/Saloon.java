package net.samitkumar.multi_tenant_saloon.saloon;

import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

import java.time.Instant;
import java.util.List;

@Document(collection = "saloons")
public record Saloon(
        @Id String id,
        String name,
        Owner owner,
        List<SaloonFeature> features,
        Instant createdAt
) {
    public Saloon {
        features = features != null ? List.copyOf(features) : List.of();
    }

    public record Owner(String name, String email, String phone) {}
}
