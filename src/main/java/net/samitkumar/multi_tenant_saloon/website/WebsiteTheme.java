package net.samitkumar.multi_tenant_saloon.website;

import org.springframework.data.annotation.Id;
import org.springframework.data.relational.core.mapping.Column;
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
        @Column("website_mode") WebsiteType websiteType,
        String headerBg,
        String footerBg,
        String mapsUrl,
        @Column("chat_layout") String chatLayout,
        @Column("chat_bg") String chatBg,
        Instant updatedAt
) {}
