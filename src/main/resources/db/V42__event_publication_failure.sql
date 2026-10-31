-- Why a listener failed. Modulith's event_publication keeps only the status and attempt count, so
-- EventListenerFailureRecorder writes one row per failed attempt. No FK: the publication later
-- moves to the archive or is deleted, and the reason should outlive neither more nor less than retention.
CREATE TABLE IF NOT EXISTS event_publication_failure (
    id             BIGSERIAL PRIMARY KEY,
    publication_id UUID,
    listener_id    TEXT        NOT NULL,
    event_type     TEXT        NOT NULL,
    error_class    TEXT        NOT NULL,
    message        TEXT,
    stack_trace    TEXT,
    failed_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_event_publication_failure_publication ON event_publication_failure(publication_id, failed_at DESC);
CREATE INDEX IF NOT EXISTS idx_event_publication_failure_failed_at ON event_publication_failure(failed_at);
