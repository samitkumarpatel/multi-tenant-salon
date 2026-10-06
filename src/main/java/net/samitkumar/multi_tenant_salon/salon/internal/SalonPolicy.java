package net.samitkumar.multi_tenant_salon.salon.internal;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;

record SalonPolicy(
        @NotBlank @Size(max = 80) String key,
        @NotBlank @Size(max = 120) String title,
        boolean enabled,
        boolean website,
        boolean booking,
        @NotBlank String source,
        @NotBlank String defaultLanguage,
        @NotNull Map<String, @Size(max = 30000) String> translations) {

    static final Set<String> LANGUAGES = Set.of("en", "da", "sv", "nb", "fr", "de");
    private static final Pattern KEY = Pattern.compile("[a-z0-9][a-z0-9-]{0,79}");

    SalonPolicy {
        if (key == null || !KEY.matcher(key).matches() || title == null || title.isBlank() || title.length() > 120
                || !Set.of("DEFAULT", "CUSTOM").contains(source)
                || defaultLanguage == null || !LANGUAGES.contains(defaultLanguage)
                || translations == null || translations.size() > LANGUAGES.size()
                || translations.keySet().stream().anyMatch(language -> !LANGUAGES.contains(language))
                || translations.values().stream().anyMatch(text -> text == null || text.length() > 30_000)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid salon policy document.");
        }
        translations = Map.copyOf(translations);
    }
}
