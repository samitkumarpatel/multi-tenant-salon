package net.samitkumar.multi_tenant_salon;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.events.EventPublication;
import org.springframework.modulith.events.FailedEventPublications;

import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** Failed event publications are retried with exponential backoff, and given up on after max attempts. */
class EventPublicationMaintenanceTest {

    final Instant now = Instant.parse("2026-10-22T12:00:00Z");
    final EventPublicationMaintenance maintenance = new EventPublicationMaintenance(mock(FailedEventPublications.class),
            mock(JdbcClient.class), Clock.fixed(now, ZoneOffset.UTC), 5, Duration.ofMinutes(1), Duration.ofMinutes(30),
            50, Duration.ofDays(2), Duration.ofDays(90));

    @Test void backoffDoublesPerAttemptUpToTheCap() {
        assertThat(maintenance.backoff(0)).isEqualTo(Duration.ofMinutes(1));
        assertThat(maintenance.backoff(1)).isEqualTo(Duration.ofMinutes(2));
        assertThat(maintenance.backoff(3)).isEqualTo(Duration.ofMinutes(8));
        assertThat(maintenance.backoff(10)).isEqualTo(Duration.ofMinutes(30));
    }

    @Test void retriesOnlyOnceTheBackoffHasPassed() {
        assertThat(maintenance.dueForRetry(failed(0, now.minusSeconds(30), null))).isFalse();
        assertThat(maintenance.dueForRetry(failed(0, now.minusSeconds(61), null))).isTrue();
        // After a resubmission the clock restarts from that attempt, with a longer wait.
        assertThat(maintenance.dueForRetry(failed(2, now.minus(Duration.ofHours(1)), now.minus(Duration.ofMinutes(3))))).isFalse();
        assertThat(maintenance.dueForRetry(failed(2, now.minus(Duration.ofHours(1)), now.minus(Duration.ofMinutes(5))))).isTrue();
    }

    @Test void givesUpAfterMaxAttempts() {
        assertThat(maintenance.dueForRetry(failed(5, now.minus(Duration.ofDays(1)), now.minus(Duration.ofDays(1))))).isFalse();
    }

    @Test void neverRetriesEventsOlderThanMaxAge() {
        // e.g. left over from before the upgrade: a days-old booking email is not worth sending now.
        assertThat(maintenance.dueForRetry(failed(0, now.minus(Duration.ofDays(3)), null))).isFalse();
        assertThat(maintenance.dueForRetry(failed(0, now.minus(Duration.ofDays(1)), null))).isTrue();
    }

    private static EventPublication failed(int attempts, Instant published, Instant lastResubmission) {
        var publication = mock(EventPublication.class);
        when(publication.getCompletionAttempts()).thenReturn(attempts);
        when(publication.getPublicationDate()).thenReturn(published);
        when(publication.getLastResubmissionDate()).thenReturn(lastResubmission);
        return publication;
    }
}
