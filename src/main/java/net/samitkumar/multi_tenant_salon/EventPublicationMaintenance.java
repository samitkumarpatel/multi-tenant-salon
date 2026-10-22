package net.samitkumar.multi_tenant_salon;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.modulith.events.EventPublication;
import org.springframework.modulith.events.FailedEventPublications;
import org.springframework.modulith.events.ResubmissionOptions;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/**
 * Makes the Spring Modulith event publication registry ({@code event_publication}) actually deliver
 * at least once. A module listener that throws leaves its publication {@code FAILED}; one that never
 * finished (the app stopped mid-delivery) is marked {@code FAILED} by Modulith's staleness monitor
 * ({@code spring.modulith.events.staleness.*}). This job resubmits those with exponential backoff —
 * {@code initial-backoff × 2^attempts}, capped at {@code max-backoff} — up to {@code max-attempts},
 * after which they stay {@code FAILED} in the table and are reported here for a person to look at.
 * Publications older than {@code max-age} are never retried either: an email about a months-old booking
 * is worse than none.
 * Resubmission claims each publication with a conditional update, so several API replicas can run
 * this at once without delivering an event twice. Completed publications are archived
 * ({@code completion-mode: archive}) and the archive is pruned after {@code archive-retention}.
 */
@Component
@Slf4j
class EventPublicationMaintenance {

    private final FailedEventPublications failed;
    private final JdbcClient jdbc;
    private final Clock clock;
    private final int maxAttempts;
    private final Duration initialBackoff;
    private final Duration maxBackoff;
    private final int batchSize;
    private final Duration maxAge;
    private final Duration archiveRetention;

    @Autowired
    EventPublicationMaintenance(FailedEventPublications failed, JdbcClient jdbc,
                                @Value("${app.events.retry.max-attempts:10}") int maxAttempts,
                                @Value("${app.events.retry.initial-backoff:PT1M}") Duration initialBackoff,
                                @Value("${app.events.retry.max-backoff:PT6H}") Duration maxBackoff,
                                @Value("${app.events.retry.batch-size:50}") int batchSize,
                                @Value("${app.events.retry.max-age:P2D}") Duration maxAge,
                                @Value("${app.events.archive-retention:P90D}") Duration archiveRetention) {
        this(failed, jdbc, Clock.systemUTC(), maxAttempts, initialBackoff, maxBackoff, batchSize, maxAge, archiveRetention);
    }

    EventPublicationMaintenance(FailedEventPublications failed, JdbcClient jdbc, Clock clock, int maxAttempts,
                                Duration initialBackoff, Duration maxBackoff, int batchSize, Duration maxAge,
                                Duration archiveRetention) {
        this.failed = failed;
        this.jdbc = jdbc;
        this.clock = clock;
        this.maxAttempts = maxAttempts;
        this.initialBackoff = initialBackoff;
        this.maxBackoff = maxBackoff;
        this.batchSize = batchSize;
        this.maxAge = maxAge;
        this.archiveRetention = archiveRetention;
    }

    @Scheduled(initialDelayString = "${app.events.retry.interval:PT1M}", fixedDelayString = "${app.events.retry.interval:PT1M}")
    void resubmitFailedPublications() {
        try {
            failed.resubmit(ResubmissionOptions.defaults().withBatchSize(batchSize).withMaxInFlight(batchSize)
                    .withFilter(this::dueForRetry));
        } catch (RuntimeException e) {
            log.error("[EVENTS] Resubmitting failed event publications failed", e);
        }
    }

    /** Whether a failed publication should be delivered again now. */
    boolean dueForRetry(EventPublication publication) {
        int attempts = publication.getCompletionAttempts();
        if (attempts >= maxAttempts || publication.getPublicationDate().isBefore(clock.instant().minus(maxAge))) return false;
        var last = publication.getLastResubmissionDate() != null ? publication.getLastResubmissionDate() : publication.getPublicationDate();
        return !clock.instant().isBefore(last.plus(backoff(attempts)));
    }

    Duration backoff(int attempts) {
        var delay = initialBackoff;
        for (int i = 0; i < Math.max(0, attempts) && delay.compareTo(maxBackoff) < 0; i++) delay = delay.multipliedBy(2);
        return delay.compareTo(maxBackoff) > 0 ? maxBackoff : delay;
    }

    /** Hourly: publications that used up their retries need a person — say which listener and event. */
    @Scheduled(initialDelayString = "PT5M", fixedDelayString = "PT1H")
    void reportExhaustedPublications() {
        try {
            jdbc.sql("""
                    SELECT listener_id, event_type, count(*) AS stuck, min(publication_date) AS oldest
                    FROM event_publication WHERE status = 'FAILED' AND (completion_attempts >= :max OR publication_date < :tooOld)
                    GROUP BY listener_id, event_type""")
                    .param("max", maxAttempts)
                    .param("tooOld", OffsetDateTime.ofInstant(clock.instant().minus(maxAge), ZoneOffset.UTC))
                    .query((rs, i) -> {
                        log.error("[EVENTS] {} {} publication(s) for listener {} are no longer retried ({} attempts or older "
                                        + "than {}; oldest {}) — fix the cause, then resubmit or delete them",
                                rs.getLong("stuck"), rs.getString("event_type"), rs.getString("listener_id"), maxAttempts,
                                maxAge, rs.getObject("oldest", OffsetDateTime.class));
                        return null;
                    }).list();
        } catch (RuntimeException e) {
            log.warn("[EVENTS] Could not check for exhausted event publications", e);
        }
    }

    /**
     * Daily: keep delivered events for {@code archive-retention}, then drop them — from the archive, and
     * any completed rows still in {@code event_publication} from before archiving was switched on.
     */
    @Scheduled(initialDelayString = "PT10M", fixedDelayString = "P1D")
    void pruneArchive() {
        try {
            var cutoff = OffsetDateTime.ofInstant(clock.instant().minus(archiveRetention), ZoneOffset.UTC);
            int removed = jdbc.sql("DELETE FROM event_publication_archive WHERE completion_date < :cutoff")
                    .param("cutoff", cutoff).update()
                    + jdbc.sql("DELETE FROM event_publication WHERE completion_date IS NOT NULL AND completion_date < :cutoff")
                    .param("cutoff", cutoff).update();
            if (removed > 0) log.info("[EVENTS] Pruned {} archived event publication(s) older than {}", removed, archiveRetention);
        } catch (RuntimeException e) {
            log.warn("[EVENTS] Could not prune the event publication archive", e);
        }
    }
}
