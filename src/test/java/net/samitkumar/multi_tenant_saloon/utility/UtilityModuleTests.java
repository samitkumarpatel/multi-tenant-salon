package net.samitkumar.multi_tenant_saloon.utility;

import net.samitkumar.multi_tenant_saloon.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.web.servlet.client.RestTestClient;
import org.springframework.web.context.WebApplicationContext;

@ApplicationModuleTest
@Import(TestcontainersConfiguration.class)
class UtilityModuleTests {

    RestTestClient client;

    @BeforeEach
    void setUp(@Autowired WebApplicationContext context) {
        client = RestTestClient.bindToApplicationContext(context).build();
    }

    @Test
    void listCountries() {
        client.get()
                .uri("/api/utility/countries")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$[0].name").isNotEmpty()
                .jsonPath("$[0].code").isNotEmpty()
                .jsonPath("$[0].dialCode").isNotEmpty();
    }

    @Test
    void listCurrencies() {
        client.get()
                .uri("/api/utility/currencies")
                .exchange()
                .expectStatus().isOk()
                .expectBody()
                .jsonPath("$").isArray()
                .jsonPath("$[0].code").isNotEmpty()
                .jsonPath("$[0].name").isNotEmpty()
                .jsonPath("$[0].symbol").isNotEmpty();
    }
}
