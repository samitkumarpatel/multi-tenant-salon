package net.samitkumar.multi_tenant_salon.notification.internal;

import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.booking.BookingCreatedEvent;
import net.samitkumar.multi_tenant_salon.booking.BookingStatus;
import net.samitkumar.multi_tenant_salon.salon.SalonCreatedEvent;
import net.samitkumar.multi_tenant_salon.salon.SalonFeature;
import net.samitkumar.multi_tenant_salon.staff.StaffOnboardedEvent;
import net.samitkumar.multi_tenant_salon.staff.StaffRole;
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

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.timeout;
import static org.mockito.Mockito.verify;

/** The Help Center is for salon owners and staff: their emails link it, customer emails never do. */
@ApplicationModuleTest(mode = ApplicationModuleTest.BootstrapMode.ALL_DEPENDENCIES)
@Import(TestcontainersConfiguration.class)
@TestPropertySource(properties = {
        "spring.application.notification.mailjet.api-key=test-key",
        "spring.application.notification.help-url=https://help.example.test"
})
class HelpCenterLinkEmailTests {

    @Autowired ApplicationEventPublisher events;
    @Autowired PlatformTransactionManager transactionManager;
    @MockitoBean MailjetClient mailjet;

    @Test
    void ownerWelcomeEmailLinksTheSetupGuide() {
        publish(new SalonCreatedEvent(UUID.randomUUID(), "Glow Studio", "glow", "Olivia", "olivia@example.com", null,
                List.of(SalonFeature.BOOKING)));

        var message = sentMessage();
        assertThat(message.textPart()).contains("https://help.example.test/en/docs/getting-started/sign-up-and-onboarding");
        assertThat(message.htmlPart()).contains("href=\"https://help.example.test/en/docs/getting-started/sign-up-and-onboarding\"",
                "href=\"https://help.example.test/en/docs\"");
    }

    @Test
    void staffWelcomeEmailLinksTheStaffPortalGuide() {
        publish(new StaffOnboardedEvent(UUID.randomUUID(), 3L, "Sam", "sam@example.com", StaffRole.STYLIST, "Glow Studio",
                "glow", List.of()));

        var message = sentMessage();
        assertThat(message.htmlPart()).contains("href=\"https://help.example.test/en/docs/staff-portal/logging-in-and-your-schedule\"");
    }

    @Test
    void customerEmailsNeverLinkTheHelpCenter() {
        publish(new BookingCreatedEvent(9L, UUID.randomUUID(), 1L, 2L, "Ann", "ann@example.com", null,
                LocalDate.now().plusDays(3), LocalTime.of(10, 0), LocalTime.of(11, 0), BookingStatus.CONFIRMED,
                "Glow Studio", "+4512345678", "hi@glow.test"));

        var message = sentMessage();
        assertThat(message.to()).extracting(MailjetEmail::email).containsExactly("ann@example.com");
        assertThat(message.textPart()).doesNotContain("help.example.test");
        assertThat(message.htmlPart()).doesNotContain("help.example.test");
    }

    /** Module listeners fire after commit, so publish inside a transaction like the publishing modules do. */
    private void publish(Object event) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> events.publishEvent(event));
    }

    private MailjetMessage sentMessage() {
        var captor = ArgumentCaptor.forClass(MailjetRequest.class);
        verify(mailjet, timeout(10_000)).send(captor.capture());
        return captor.getValue().messages().getFirst();
    }
}
