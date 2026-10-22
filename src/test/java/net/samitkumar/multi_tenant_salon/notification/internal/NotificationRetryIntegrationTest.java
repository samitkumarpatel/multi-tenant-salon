package net.samitkumar.multi_tenant_salon.notification.internal;

import net.samitkumar.multi_tenant_salon.MultiTenantSalonApplication;
import net.samitkumar.multi_tenant_salon.TestcontainersConfiguration;
import net.samitkumar.multi_tenant_salon.salon.SalonDisabledEvent;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.FailedEventPublications;
import org.springframework.modulith.events.ResubmissionOptions;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.client.HttpClientErrorException;
import org.springframework.web.client.ResourceAccessException;

import java.time.Duration;
import java.util.Map;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.reset;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Emails ride on Spring Modulith's event publication registry: a temporary Mailjet failure leaves the
 * publication FAILED in {@code event_publication} and a resubmission sends the email after all, while
 * a message Mailjet rejects outright is not retried.
 */
@SpringBootTest(classes = MultiTenantSalonApplication.class, properties = {
        "spring.application.notification.mailjet.api-key=test-key",
        // Keep the scheduled retry job out of the way; the test resubmits explicitly.
        "app.events.retry.interval=PT1H"
})
@Import(TestcontainersConfiguration.class)
class NotificationRetryIntegrationTest {

    @Autowired ApplicationEventPublisher events;
    @Autowired PlatformTransactionManager transactionManager;
    @Autowired JdbcTemplate jdbc;
    @Autowired FailedEventPublications failed;
    @MockitoBean MailjetClient mailjet;

    @Test
    void aTemporaryMailjetFailureIsRetriedUntilTheEmailIsSent() {
        reset(mailjet);
        when(mailjet.send(any())).thenThrow(new ResourceAccessException("Mailjet unreachable")).thenReturn(Map.of());
        var event = disabled();

        publish(event);
        await().atMost(Duration.ofSeconds(15)).until(() -> statusOf(event).equals("FAILED"));

        failed.resubmit(ResubmissionOptions.defaults());
        await().atMost(Duration.ofSeconds(15)).until(() -> undelivered(event) == 0);
        verify(mailjet, times(2)).send(any());
    }

    @Test
    void aMessageMailjetRejectsIsNotRetried() {
        reset(mailjet);
        when(mailjet.send(any())).thenThrow(HttpClientErrorException.create(HttpStatus.BAD_REQUEST, "Bad Request", null, null, null));
        var event = disabled();

        publish(event);
        await().atMost(Duration.ofSeconds(15)).until(() -> undelivered(event) == 0);
        verify(mailjet, times(1)).send(any());
    }

    private SalonDisabledEvent disabled() {
        return new SalonDisabledEvent(UUID.randomUUID(), "Retry Salon", "Owner", "owner-" + UUID.randomUUID() + "@retry.test");
    }

    private void publish(Object event) {
        new TransactionTemplate(transactionManager).executeWithoutResult(status -> events.publishEvent(event));
    }

    private String statusOf(SalonDisabledEvent event) {
        var statuses = jdbc.queryForList("SELECT status FROM event_publication WHERE serialized_event LIKE ?", String.class,
                "%" + event.salonId() + "%");
        return statuses.isEmpty() ? "" : statuses.getFirst();
    }

    private int undelivered(SalonDisabledEvent event) {
        return jdbc.queryForObject("SELECT count(*) FROM event_publication WHERE serialized_event LIKE ?", Integer.class,
                "%" + event.salonId() + "%");
    }
}
