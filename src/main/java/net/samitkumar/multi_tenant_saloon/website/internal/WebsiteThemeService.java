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
                .orElse(new WebsiteTheme(saloonId, "#F8FAFC", "#0F172A", "#059669", "nunito", "#7C3AED", "static", "#FFFFFF", "#1E293B", null, null));
    }

    WebsiteTheme saveTheme(UUID saloonId, String heroBg, String heroTextColor,
                           String accentColor, String fontFamily, String logoBgColor,
                           String headerBg, String footerBg, String mapsUrl) {
        jdbc.update("""
                INSERT INTO saloon_website_theme
                  (saloon_id, hero_bg, hero_text_color, accent_color, font_family, logo_bg_color, header_bg, footer_bg, maps_url, updated_at)
                VALUES
                  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (saloon_id) DO UPDATE SET
                  hero_bg         = EXCLUDED.hero_bg,
                  hero_text_color = EXCLUDED.hero_text_color,
                  accent_color    = EXCLUDED.accent_color,
                  font_family     = EXCLUDED.font_family,
                  logo_bg_color   = EXCLUDED.logo_bg_color,
                  header_bg       = EXCLUDED.header_bg,
                  footer_bg       = EXCLUDED.footer_bg,
                  maps_url        = EXCLUDED.maps_url,
                  updated_at      = EXCLUDED.updated_at
                """,
                saloonId, heroBg, heroTextColor, accentColor, fontFamily, logoBgColor,
                headerBg, footerBg, mapsUrl, Timestamp.from(Instant.now()));

        return repository.findById(saloonId).orElseThrow();
    }

    WebsiteTheme updateWebsiteMode(UUID saloonId, String websiteMode) {
        jdbc.update("""
                INSERT INTO saloon_website_theme
                  (saloon_id, hero_bg, hero_text_color, accent_color, font_family, logo_bg_color,
                   header_bg, footer_bg, website_mode, updated_at)
                VALUES
                  (?, '#F8FAFC', '#0F172A', '#059669', 'nunito', '#7C3AED', '#FFFFFF', '#1E293B', ?, ?)
                ON CONFLICT (saloon_id) DO UPDATE SET
                  website_mode = EXCLUDED.website_mode,
                  updated_at   = EXCLUDED.updated_at
                """,
                saloonId, websiteMode, Timestamp.from(Instant.now()));

        return repository.findById(saloonId).orElseThrow();
    }
}
