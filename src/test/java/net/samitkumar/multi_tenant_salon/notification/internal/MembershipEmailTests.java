package net.samitkumar.multi_tenant_salon.notification.internal;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.membership.BillingInterval;
import net.samitkumar.multi_tenant_salon.membership.MembershipActivatedEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipCancelledEvent;
import net.samitkumar.multi_tenant_salon.membership.MembershipRenewalDueEvent;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.modulith.test.ApplicationModuleTest;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

/** The membership emails as handed to Mailjet: the welcome email carries the member's QR code inline. */
@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = "spring.application.notification.mailjet.api-key=test-key")
class MembershipEmailTests {

    @Autowired ApplicationEventPublisher events;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean MailjetClient mailjet;

    @Test
    void welcomeEmailEmbedsTheMemberQrCode() {
        publish(new MembershipActivatedEvent(7L, UUID.randomUUID(), "M7K2Q9XZT", "Ann", "ann@example.com", "Glow Monthly",
                new BigDecimal("49.00"), "EUR", BillingInterval.MONTHLY, Instant.parse("2026-11-21T10:00:00Z"),
                List.of("Priority booking", "<b>Free</b> drink"), "Glow Studio", "+4512345678", "hi@glow.test",
                MembershipActivatedEvent.Kind.WELCOME));

        var message = sentMessage();
        assertThat(message.to()).extracting(MailjetEmail::email).containsExactly("ann@example.com");
        assertThat(message.subject()).contains("Welcome!", "Glow Monthly");
        assertThat(message.htmlPart()).contains("cid:member-qr", "M7K2Q9XZT", "&lt;b&gt;Free&lt;/b&gt; drink", "21 Nov 2026");
        assertThat(message.textPart()).contains("Member code : M7K2Q9XZT", "per month", "Member until: Sat, 21 Nov 2026");
        assertThat(message.inlinedAttachments()).singleElement().satisfies(a -> {
            assertThat(a.contentId()).isEqualTo("member-qr");
            assertThat(a.contentType()).isEqualTo("image/png");
            assertThat(Base64.getDecoder().decode(a.base64Content())).startsWith(0x89, 'P', 'N', 'G');
        });
    }

    @Test
    void cancellationEmailSaysWhenTheMembershipEnds() {
        publish(new MembershipCancelledEvent(8L, UUID.randomUUID(), "M7K2Q9XZT", "Ann", "ann@example.com", "Glow Monthly",
                Instant.parse("2026-11-21T10:00:00Z"), false, "Glow Studio", null, null));

        var message = sentMessage();
        assertThat(message.subject()).contains("Membership cancelled");
        assertThat(message.textPart()).contains("stays active until Sat, 21 Nov 2026");
        assertThat(message.inlinedAttachments()).isEmpty();
    }

    @Test
    void renewalEmailLinksToTheWebsiteRenewalPage() {
        publish(new MembershipRenewalDueEvent(9L, UUID.randomUUID(), "M7K2Q9XZT", "Ann", "ann@example.com", "Glow Monthly",
                new BigDecimal("49.00"), "EUR", BillingInterval.MONTHLY, Instant.parse("2026-11-21T10:00:00Z"), false,
                "tok123", "glow", "Glow Studio", null, null));

        var message = sentMessage();
        assertThat(message.subject()).contains("Time to renew your Glow Monthly membership");
        assertThat(message.textPart()).contains("https://glow.salonsaas.org/membership?renew=tok123", "runs until Sat, 21 Nov 2026");
        assertThat(message.htmlPart()).contains("href=\"https://glow.salonsaas.org/membership?renew=tok123\"");
    }

    /** Module listeners fire after commit, so publish inside a transaction like the membership module does. */
    private void publish(Object event) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> events.publishEvent(event));
    }

    private MailjetMessage sentMessage() {
        var captor = ArgumentCaptor.forClass(MailjetRequest.class);
        verify(mailjet, timeout(10_000)).send(captor.capture());
        return captor.getValue().messages().getFirst();
    }
}
