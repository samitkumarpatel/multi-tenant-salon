-- Every payment link the salon sends for an appointment (a no-show fee, an unpaid visit), so the salon admin and the
-- desk can see what was sent, to whom, whether it is still open, and follow up. The money itself stays in `payment`.
CREATE TABLE IF NOT EXISTS booking_payment_link (
  id                BIGSERIAL     PRIMARY KEY,
  salon_id          UUID          NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  booking_id        BIGINT        NOT NULL REFERENCES booking(id) ON DELETE CASCADE,
  checkout_session_id VARCHAR(255) NOT NULL UNIQUE,
  url               TEXT          NOT NULL,
  amount            NUMERIC(12,2) NOT NULL,
  currency          VARCHAR(3)    NOT NULL,
  -- OPEN until Stripe reports an outcome; SUPERSEDED when the salon sent a newer link for the same appointment.
  status            VARCHAR(12)   NOT NULL DEFAULT 'OPEN',
  created_by        VARCHAR(254),
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  -- Stripe keeps a hosted checkout page open for 24 hours.
  expires_at        TIMESTAMPTZ   NOT NULL,
  paid_at           TIMESTAMPTZ,
  emailed_to        VARCHAR(254),
  last_emailed_at   TIMESTAMPTZ,
  email_count       INTEGER       NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS booking_payment_link_booking_idx ON booking_payment_link (salon_id, booking_id, created_at DESC);
CREATE INDEX IF NOT EXISTS booking_payment_link_open_idx ON booking_payment_link (salon_id, status, created_at DESC);
