package net.samitkumar.multi_tenant_salon.website.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.website.WebsiteType;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.stereotype.Component;

import java.sql.Timestamp;
import java.time.Instant;

@Component
@Slf4j
class DefaultWebsiteThemeSeeder {

    private final JdbcTemplate jdbc;

    DefaultWebsiteThemeSeeder(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @ApplicationModuleListener
    void onSalonCreated(SalonCreatedEvent event) {
        jdbc.update("""
                INSERT INTO salon_website_theme
                  (salon_id, hero_bg, hero_text_color, accent_color, font_family, logo_bg_color,
                   header_bg, footer_bg, website_mode, updated_at)
                VALUES
                  (?, '#EEF2F4', '#0F172A', '#7C3AED', 'nunito', '#7C3AED', '#E2E8F0', '#E2E8F0', ?, ?)
                ON CONFLICT (salon_id) DO NOTHING
                """,
                event.salonId(), WebsiteType.STATIC_WEBSITE.name(), Timestamp.from(Instant.now()));

        log.info("[WEBSITE] Seeded default theme for salon '{}'", event.salonName());
    }
}
