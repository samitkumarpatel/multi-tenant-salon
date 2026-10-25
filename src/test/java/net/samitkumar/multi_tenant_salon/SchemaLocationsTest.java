package net.samitkumar.multi_tenant_salon;

import org.junit.jupiter.api.Test;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.support.PathMatchingResourcePatternResolver;

import java.nio.charset.StandardCharsets;
import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * The app applies its schema from the explicit {@code spring.sql.init.schema-locations} list in
 * application.yaml, not by scanning {@code db/}. A migration file missing from the list is silently never
 * applied outside Flyway-enabled tests, so every {@code db/V*.sql} must be listed.
 */
class SchemaLocationsTest {

    @Test
    void everyMigrationFileIsListedInApplicationYaml() throws Exception {
        var yaml = new String(new ClassPathResource("application.yaml").getInputStream().readAllBytes(), StandardCharsets.UTF_8);
        var files = Arrays.stream(new PathMatchingResourcePatternResolver().getResources("classpath:db/V*.sql"))
                .map(resource -> resource.getFilename()).toList();

        assertThat(files).isNotEmpty();
        assertThat(files).allSatisfy(file -> assertThat(yaml).as("%s is missing from schema-locations", file)
                .contains("classpath:db/" + file));
    }
}
