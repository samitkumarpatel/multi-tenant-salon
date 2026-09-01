-- Generative-UI chat usage events (public website chat widget): one row per notable happening in
-- a chat turn (message sent, an interactive component shown, a data-lookup tool invoked, a
-- booking proposed), published by the chat module and recorded here by the analytics module's
-- listener. Only collected for salons that have opted in via the ANALYTICS feature flag on
-- `salon_feature`, same as analytics_event.
CREATE TABLE IF NOT EXISTS genui_event (
  id          BIGSERIAL    PRIMARY KEY,
  salon_id    UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  session_id  VARCHAR(100),
  event_type  VARCHAR(30)  NOT NULL,
  detail      VARCHAR(60),
  occurred_at TIMESTAMPTZ  NOT NULL
);

CREATE INDEX IF NOT EXISTS genui_event_salon_occurred_idx ON genui_event (salon_id, occurred_at);
