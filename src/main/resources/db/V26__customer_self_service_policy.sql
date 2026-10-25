-- What a customer may do to their own appointments from their account (cancel / reschedule) and how
-- close to the start they may still do it. One optional row per salon: no row means the defaults below,
-- so every existing salon is covered without a backfill. Every statement is idempotent — the whole
-- schema is re-applied on each startup (spring.sql.init.mode: always).

CREATE TABLE IF NOT EXISTS customer_self_service_policy (
  salon_id                 UUID        PRIMARY KEY REFERENCES salon(id) ON DELETE CASCADE,
  allow_cancel             BOOLEAN     NOT NULL DEFAULT TRUE,
  cancel_notice_hours      INTEGER     NOT NULL DEFAULT 24 CHECK (cancel_notice_hours BETWEEN 0 AND 720),
  allow_reschedule         BOOLEAN     NOT NULL DEFAULT TRUE,
  reschedule_notice_hours  INTEGER     NOT NULL DEFAULT 24 CHECK (reschedule_notice_hours BETWEEN 0 AND 720),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);
