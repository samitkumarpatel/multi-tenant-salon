-- Public-website activity events (page views, tracked clicks), ingested via an Azure Storage
-- Queue and refined into this table by the analytics module's queue consumer. Only collected
-- for salons that have opted in via the ANALYTICS feature flag on `salon_feature`.
CREATE TABLE IF NOT EXISTS analytics_event (
  id          BIGSERIAL    PRIMARY KEY,
  salon_id    UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  event_type  VARCHAR(20)  NOT NULL,
  path        VARCHAR(500),
  label       VARCHAR(255),
  session_id  VARCHAR(100),
  occurred_at TIMESTAMPTZ  NOT NULL,
  received_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS analytics_event_salon_occurred_idx ON analytics_event (salon_id, occurred_at);
