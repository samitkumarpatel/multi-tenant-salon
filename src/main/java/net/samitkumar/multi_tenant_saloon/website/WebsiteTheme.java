package net.samitkumar.multi_tenant_saloon.website;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Table;

import java.time.Instant;
import java.util.UUID;

@Table("saloon_website_theme")
public record WebsiteTheme(
        @Id UUID saloonId,
        String heroBg,
        String heroTextColor,
        String accentColor,
        String fontFamily,
        String logoBgColor,
        Instant updatedAt
) {}
