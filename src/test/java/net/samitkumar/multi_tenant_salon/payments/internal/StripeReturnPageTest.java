package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.salon.Salon;
import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.utility.CountryApi;
import net.samitkumar.multi_tenant_salon.website.WebsiteDomainApi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.web.client.RestClient;

import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class StripeReturnPageTest {
    final UUID salonId = UUID.randomUUID();
    final WebsiteDomainApi domains = mock(WebsiteDomainApi.class);
    Salon salon;
    StripeConnectService service;

    @BeforeEach void setup() {
        salon = mock(Salon.class);
        when(salon.id()).thenReturn(salonId);
        when(salon.handler()).thenReturn("glow");
        when(domains.isActiveOriginFor(salonId, "https://www.glow.dk")).thenReturn(true);
        service = StripeTestSupport.service(mock(StripeConnectedAccountRepository.class), mock(SalonApi.class),
                mock(CountryApi.class), StripeTestSupport.client(RestClient.builder(), null), mock(PaymentLedger.class),
                mock(ApplicationEventPublisher.class), domains, null, "https://book.salonsaas.org/");
    }

    @Test void returnsToTheSalonsActiveCustomDomain() {
        assertThat(service.returnPage(salon, "SHOP", "https://www.glow.dk/shop?payment=cancel&session_id=x&ref=ad#cart"))
                .isEqualTo("https://www.glow.dk/shop?ref=ad");
        assertThat(service.returnPage(salon, "BOOKING", "https://WWW.glow.dk:443/book"))
                .isEqualTo("https://WWW.glow.dk:443/book");
    }

    @Test void returnsToIncludedSubdomainAndPlatformApps() {
        assertThat(service.returnPage(salon, "SHOP", "https://glow.salonsaas.org/shop")).isEqualTo("https://glow.salonsaas.org/shop");
        assertThat(service.returnPage(salon, "BOOKING", "https://book.salonsaas.org/glow")).isEqualTo("https://book.salonsaas.org/glow");
    }

    @Test void rejectsForeignOrUnverifiedOriginsAndFallsBack() {
        assertThat(service.returnPage(salon, "SHOP", "https://evil.example/shop")).isEqualTo("https://glow.salonsaas.org/");
        assertThat(service.returnPage(salon, "SHOP", "https://other.salonsaas.org/shop")).isEqualTo("https://glow.salonsaas.org/");
        assertThat(service.returnPage(salon, "SHOP", "http://www.glow.dk/shop")).isEqualTo("https://glow.salonsaas.org/");
        assertThat(service.returnPage(salon, "SHOP", "https://user@www.glow.dk/shop")).isEqualTo("https://glow.salonsaas.org/");
        assertThat(service.returnPage(salon, "SHOP", "javascript:alert(1)")).isEqualTo("https://glow.salonsaas.org/");
        assertThat(service.returnPage(salon, "BOOKING", null)).isEqualTo("https://book.salonsaas.org/glow");
        // POS always returns to the dashboard; the customer-supplied page is ignored.
        assertThat(service.returnPage(salon, "POS", "https://www.glow.dk/"))
                .isEqualTo("https://dashboard.salonsaas.org/" + salonId + "?view=cashier&cashierView=pos");
    }
}
