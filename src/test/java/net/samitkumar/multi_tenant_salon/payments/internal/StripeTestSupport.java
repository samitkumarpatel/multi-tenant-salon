package net.samitkumar.multi_tenant_salon.payments.internal;

import net.samitkumar.multi_tenant_salon.salon.SalonApi;
import net.samitkumar.multi_tenant_salon.utility.CountryApi;
import net.samitkumar.multi_tenant_salon.website.WebsiteDomainApi;
import net.samitkumar.multi_tenant_salon.website.WebsiteThemeApi;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.client.RestClient;

import java.time.Duration;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Builds a {@link StripeConnectService} for plain unit tests (no Spring context). */
final class StripeTestSupport {
    static final String API_VERSION = "2026-08-26.dahlia";

    private StripeTestSupport() {}

    /** Zero timeouts so the builder keeps the {@code MockRestServiceServer} transport bound to it. */
    static StripeClient client(RestClient.Builder builder, String publishableKey) {
        return new StripeClient(builder, "sk_test_x", publishableKey, API_VERSION,
                Duration.ZERO, Duration.ZERO);
    }

    @SuppressWarnings("unchecked")
    static StripeConnectService service(StripeConnectedAccountRepository accounts, SalonApi salons, CountryApi countries,
                                        StripeClient client, PaymentLedger ledger, ApplicationEventPublisher events,
                                        WebsiteDomainApi domains, WebsiteThemeApi themes, String bookingAppUrl) {
        ObjectProvider<WebsiteDomainApi> domainProvider = mock(ObjectProvider.class);
        when(domainProvider.getIfAvailable()).thenReturn(domains);
        ObjectProvider<WebsiteThemeApi> themeProvider = mock(ObjectProvider.class);
        when(themeProvider.getIfAvailable()).thenReturn(themes);
        return new StripeConnectService(accounts, salons, countries, client, ledger,
                mock(StripeTerminalService.class), mock(StripeRefundService.class),
                "https://admin.salonsaas.org", "https://dashboard.salonsaas.org", "whsec_x", bookingAppUrl, "",
                "salonsaas.org", events, mock(JdbcTemplate.class), domainProvider, themeProvider);
    }
}
