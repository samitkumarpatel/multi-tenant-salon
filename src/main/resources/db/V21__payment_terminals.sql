-- Stripe Terminal card readers. Every reader belongs to the salon's single Terminal Location
-- (created on the salon's connected account from the salon address on first registration).
CREATE TABLE IF NOT EXISTS payment_terminal_location (
  salon_id            UUID         PRIMARY KEY REFERENCES salon(id) ON DELETE CASCADE,
  stripe_location_id  VARCHAR(80)  NOT NULL UNIQUE,
  created_at          TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS payment_terminal (
  id                BIGSERIAL     PRIMARY KEY,
  salon_id          UUID          NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  stripe_reader_id  VARCHAR(80)   NOT NULL UNIQUE,
  label             VARCHAR(120)  NOT NULL,
  device_type       VARCHAR(60),
  serial_number     VARCHAR(120),
  -- online / offline as last reported by Stripe (null for mobile readers)
  status            VARCHAR(20),
  created_at        TIMESTAMPTZ   NOT NULL,
  updated_at        TIMESTAMPTZ   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_terminal_salon ON payment_terminal (salon_id);
