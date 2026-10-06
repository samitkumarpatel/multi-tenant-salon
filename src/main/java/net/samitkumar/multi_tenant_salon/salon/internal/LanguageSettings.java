package net.samitkumar.multi_tenant_salon.salon.internal;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;

record LanguageSettings(@NotNull @Valid Policy website, @NotNull @Valid Policy booking,
                        @NotNull @Valid Policy dashboard) {
    static final Set<String> SUPPORTED = Set.of("en", "da", "sv", "nb", "fr", "de");

    record Policy(List<String> enabled, String defaultLanguage) {
        Policy {
            if (enabled == null || enabled.isEmpty() || enabled.size() > SUPPORTED.size()
                    || enabled.stream().anyMatch(language -> language == null || !SUPPORTED.contains(language))
                    || enabled.stream().distinct().count() != enabled.size()
                    || defaultLanguage == null || !enabled.contains(defaultLanguage)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Choose supported languages and a default language from the enabled languages.");
            }
            enabled = List.copyOf(enabled);
        }

        static Policy defaults() { return new Policy(List.of("en"), "en"); }
    }
}
