package net.samitkumar.multi_tenant_saloon.website.internal;

import net.samitkumar.multi_tenant_saloon.website.WebsiteTheme;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;

import java.sql.Types;
import java.time.Instant;
import java.util.UUID;

@Service
class WebsiteThemeService {

    private final WebsiteThemeRepository repository;
    private final NamedParameterJdbcTemplate jdbc;

    WebsiteThemeService(WebsiteThemeRepository repository, NamedParameterJdbcTemplate jdbc) {
        this.repository = repository;
        this.jdbc = jdbc;
    }

    WebsiteTheme getTheme(UUID saloonId) {
        return repository.findById(saloonId)
                .orElse(new WebsiteTheme(saloonId, "#0F172A", "#FFFFFF", "#F59E0B", "inter", "#F59E0B", null));
    }

    WebsiteTheme saveTheme(UUID saloonId, String heroBg, String heroTextColor,
                           String accentColor, String fontFamily, String logoBgColor) {
        var params = new MapSqlParameterSource()
                .addValue("saloonId", saloonId)
                .addValue("heroBg", heroBg)
                .addValue("heroTextColor", heroTextColor)
                .addValue("accentColor", accentColor)
                .addValue("fontFamily", fontFamily)
                .addValue("logoBgColor", logoBgColor)
                .addValue("updatedAt", Instant.now(), Types.TIMESTAMP_WITH_TIMEZONE);

        jdbc.update("""
                INSERT INTO saloon_website_theme
                  (saloon_id, hero_bg, hero_text_color, accent_color, font_family, logo_bg_color, updated_at)
                VALUES
                  (:saloonId, :heroBg, :heroTextColor, :accentColor, :fontFamily, :logoBgColor, :updatedAt)
                ON CONFLICT (saloon_id) DO UPDATE SET
                  hero_bg         = :heroBg,
                  hero_text_color = :heroTextColor,
                  accent_color    = :accentColor,
                  font_family     = :fontFamily,
                  logo_bg_color   = :logoBgColor,
                  updated_at      = :updatedAt
                """, params);

        return repository.findById(saloonId).orElseThrow();
    }
}
