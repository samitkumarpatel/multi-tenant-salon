package net.samitkumar.multi_tenant_salon.salon.internal;

import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Arrays;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
class LanguageSettingsService {
    private final JdbcClient jdbc;

    LanguageSettingsService(JdbcClient jdbc) { this.jdbc = jdbc; }

    LanguageSettings get(UUID salonId) {
        var policies = new HashMap<String, LanguageSettings.Policy>();
        jdbc.sql("SELECT app, enabled_languages, default_language FROM salon_language_settings WHERE salon_id = :id")
                .param("id", salonId)
                .query((rs, row) -> Map.entry(rs.getString("app"), new LanguageSettings.Policy(
                        Arrays.asList(rs.getString("enabled_languages").split(",")), rs.getString("default_language"))))
                .list().forEach(entry -> policies.put(entry.getKey(), entry.getValue()));
        return new LanguageSettings(policies.getOrDefault("website", LanguageSettings.Policy.defaults()),
                policies.getOrDefault("booking", LanguageSettings.Policy.defaults()),
                policies.getOrDefault("dashboard", LanguageSettings.Policy.defaults()));
    }

    @Transactional
    public LanguageSettings save(UUID salonId, LanguageSettings settings) {
        Map.of("website", settings.website(), "booking", settings.booking(), "dashboard", settings.dashboard())
                .forEach((app, policy) -> jdbc.sql("""
                        INSERT INTO salon_language_settings (salon_id, app, enabled_languages, default_language)
                        VALUES (:id, :app, :enabled, :defaultLanguage)
                        ON CONFLICT (salon_id, app) DO UPDATE SET
                            enabled_languages = EXCLUDED.enabled_languages,
                            default_language = EXCLUDED.default_language
                        """).param("id", salonId).param("app", app)
                        .param("enabled", String.join(",", policy.enabled()))
                        .param("defaultLanguage", policy.defaultLanguage()).update());
        return settings;
    }
}
