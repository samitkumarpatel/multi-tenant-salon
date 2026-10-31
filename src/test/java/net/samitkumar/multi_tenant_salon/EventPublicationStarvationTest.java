package net.samitkumar.multi_tenant_salon;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.modulith.events.ApplicationModuleListener;
import org.springframework.transaction.support.TransactionTemplate;
import java.time.Duration;
import java.util.UUID;
import static org.assertj.core.api.Assertions.assertThat;
import static org.awaitility.Awaitility.await;

/**
 * Modulith reads the oldest failed publications first and filters afterwards. Publications that used up their
 * retries stay FAILED, so with a small batch they must not keep a newer, retryable failure from being retried.
 */
@SpringBootTest(properties = {"app.events.retry.batch-size=2", "app.events.retry.interval=P1D", "app.events.retry.max-attempts=10"})
@Import({TestcontainersConfiguration.class, EventPublicationStarvationTest.Config.class})
class EventPublicationStarvationTest {
    record StarvationProbe(String id) {}

    @TestConfiguration(proxyBeanMethods = false)
    static class Config {
        @Bean Failing failing() { return new Failing(); }
    }
    static class Failing {
        @ApplicationModuleListener
        void on(StarvationProbe event) { throw new IllegalStateException("still failing " + event.id()); }
    }

    @Autowired JdbcTemplate jdbc;
    @Autowired ApplicationEventPublisher events;
    @Autowired TransactionTemplate tx;
    @Autowired EventPublicationMaintenance maintenance;

    @Test void exhaustedPublicationsDoNotStarveANewerRetryableOne() {
        String id = UUID.randomUUID().toString();
        tx.executeWithoutResult(s -> events.publishEvent(new StarvationProbe(id)));
        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM event_publication_failure WHERE message LIKE ?", Integer.class, "%" + id)).isEqualTo(1));
        UUID retryable = jdbc.queryForObject("SELECT id FROM event_publication WHERE serialized_event LIKE ?", UUID.class, "%" + id + "%");

        // Three exhausted copies, all older than the retryable one, so they fill a batch of two ahead of it.
        for (int i = 0; i < 3; i++)
            jdbc.update("""
                    INSERT INTO event_publication(id,listener_id,event_type,serialized_event,publication_date,status,completion_attempts,last_resubmission_date)
                    SELECT gen_random_uuid(),listener_id,event_type,serialized_event,now() - interval '20 hours' - make_interval(mins => ?),'FAILED',10,now() - interval '10 hours'
                    FROM event_publication WHERE id = ?""", i, retryable);
        // Its backoff has long passed.
        jdbc.update("UPDATE event_publication SET publication_date = now() - interval '2 hours', last_resubmission_date = now() - interval '1 hour', completion_attempts = 1 WHERE id = ?", retryable);

        maintenance.resubmitFailedPublications();

        await().atMost(Duration.ofSeconds(20)).untilAsserted(() -> assertThat(jdbc.queryForObject(
                "SELECT count(*) FROM event_publication_failure WHERE publication_id = ?", Integer.class, retryable)).isGreaterThanOrEqualTo(2));
        assertThat(jdbc.queryForObject("SELECT count(*) FROM event_publication WHERE status='FAILED' AND completion_attempts = 10 AND serialized_event LIKE ?",
                Integer.class, "%" + id + "%")).as("exhausted ones are left alone").isEqualTo(3);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM event_publication_failure WHERE publication_id <> ? AND message LIKE ?",
                Integer.class, retryable, "%" + id)).isZero();
    }
}
