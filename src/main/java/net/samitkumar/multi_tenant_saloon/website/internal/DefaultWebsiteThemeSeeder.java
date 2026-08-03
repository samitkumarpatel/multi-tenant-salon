package net.samitkumar.multi_tenant_saloon.website.internal;

import lombok.extern.slf4j.Slf4j;
import net.samitkumar.multi_tenant_saloon.saloon.SaloonCreatedEvent;
import net.samitkumar.multi_tenant_saloon.website.WebsiteType;
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
    void onSaloonCreated(SaloonCreatedEvent event) {
        jdbc.update("""
                INSERT INTO saloon_website_theme
                  (saloon_id, hero_bg, hero_text_color, accent_color, font_family, logo_bg_color,
                   header_bg, footer_bg, website_mode, updated_at)
                VALUES
                  (?, '#F8FAFC', '#0F172A', '#059669', 'nunito', '#7C3AED', '#FFFFFF', '#1E293B', ?, ?)
                ON CONFLICT (saloon_id) DO NOTHING
                """,
                event.saloonId(), WebsiteType.STATIC_WEBSITE.name(), Timestamp.from(Instant.now()));

        log.info("[WEBSITE] Seeded default theme for saloon '{}'", event.saloonName());
    }
}
