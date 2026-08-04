package net.samitkumar.multi_tenant_saloon.website.internal;

import net.samitkumar.multi_tenant_saloon.website.WebsiteTheme;
import net.samitkumar.multi_tenant_saloon.website.WebsiteType;
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
                .orElse(new WebsiteTheme(saloonId, "#EEF2F4", "#0F172A", "#7C3AED", "nunito", "#7C3AED",
                        WebsiteType.STATIC_WEBSITE, "#E2E8F0", "#E2E8F0", null, "app", null, null));
    }

    WebsiteType getWebsiteType(UUID saloonId) {
        return repository.findById(saloonId)
                .map(WebsiteTheme::websiteType)
                .orElse(WebsiteType.STATIC_WEBSITE);
    }

    WebsiteTheme saveTheme(UUID saloonId, String heroBg, String heroTextColor,
                           String accentColor, String fontFamily, String logoBgColor,
                           String headerBg, String footerBg, String mapsUrl, String chatLayout,
                           String chatBg) {
        jdbc.update("""
                INSERT INTO saloon_website_theme
                  (saloon_id, hero_bg, hero_text_color, accent_color, font_family, logo_bg_color, header_bg, footer_bg, maps_url, chat_layout, chat_bg, updated_at)
                VALUES
                  (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (saloon_id) DO UPDATE SET
                  hero_bg         = EXCLUDED.hero_bg,
                  hero_text_color = EXCLUDED.hero_text_color,
                  accent_color    = EXCLUDED.accent_color,
                  font_family     = EXCLUDED.font_family,
                  logo_bg_color   = EXCLUDED.logo_bg_color,
                  header_bg       = EXCLUDED.header_bg,
                  footer_bg       = EXCLUDED.footer_bg,
                  maps_url        = EXCLUDED.maps_url,
                  chat_layout     = EXCLUDED.chat_layout,
                  chat_bg         = EXCLUDED.chat_bg,
                  updated_at      = EXCLUDED.updated_at
                """,
                saloonId, heroBg, heroTextColor, accentColor, fontFamily, logoBgColor,
                headerBg != null ? headerBg : "#E2E8F0",
                footerBg != null ? footerBg : "#E2E8F0",
                mapsUrl, chatLayout != null ? chatLayout : "app",
                chatBg, Timestamp.from(Instant.now()));

        return repository.findById(saloonId).orElseThrow();
    }

    WebsiteTheme updateWebsiteType(UUID saloonId, WebsiteType websiteType) {
        jdbc.update("""
                INSERT INTO saloon_website_theme
                  (saloon_id, hero_bg, hero_text_color, accent_color, font_family, logo_bg_color,
                   header_bg, footer_bg, website_mode, updated_at)
                VALUES
                  (?, '#F8FAFC', '#0F172A', '#1D4ED8', 'system', '#10B981', '#E2E8F0', '#E2E8F0', ?, ?)
                ON CONFLICT (saloon_id) DO UPDATE SET
                  website_mode = EXCLUDED.website_mode,
                  updated_at   = EXCLUDED.updated_at
                """,
                saloonId, websiteType.name(), Timestamp.from(Instant.now()));

        return repository.findById(saloonId).orElseThrow();
    }
}
