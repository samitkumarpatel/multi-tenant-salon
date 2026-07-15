package net.samitkumar.multi_tenant_saloon.website.internal;

import net.samitkumar.multi_tenant_saloon.website.WebsiteTheme;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

@Service
class WebsiteThemeService {

    private final WebsiteThemeRepository repository;
    private final JdbcTemplate jdbc;

    WebsiteThemeService(WebsiteThemeRepository repository, JdbcTemplate jdbc) {
        this.repository = repository;
        this.jdbc = jdbc;
    }

    WebsiteTheme getTheme(UUID saloonId) {
        return repository.findById(saloonId)
                .orElse(new WebsiteTheme(saloonId, "#0F172A", "#FFFFFF", "#F59E0B", "inter", "#F59E0B", null));
    }

    WebsiteTheme saveTheme(UUID saloonId, String heroBg, String heroTextColor,
                           String accentColor, String fontFamily, String logoBgColor) {
        jdbc.update("""
                INSERT INTO saloon_website_theme
                  (saloon_id, hero_bg, hero_text_color, accent_color, font_family, logo_bg_color, updated_at)
                VALUES
                  (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (saloon_id) DO UPDATE SET
                  hero_bg         = EXCLUDED.hero_bg,
                  hero_text_color = EXCLUDED.hero_text_color,
                  accent_color    = EXCLUDED.accent_color,
                  font_family     = EXCLUDED.font_family,
                  logo_bg_color   = EXCLUDED.logo_bg_color,
                  updated_at      = EXCLUDED.updated_at
                """,
                saloonId, heroBg, heroTextColor, accentColor, fontFamily, logoBgColor,
                Timestamp.from(Instant.now()));

        return repository.findById(saloonId).orElseThrow();
    }
}
