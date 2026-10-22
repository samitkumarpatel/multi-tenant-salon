-- Payment areas move from one boolean column per area on salon_payment_settings to a row per
-- (salon, area), which also carries how the customer pays in that area (checkout_ui).
-- salon_payment_settings keeps the booking deposit options; its *_enabled columns are no longer
-- written (kept so this script stays re-runnable: spring.sql.init runs it on every start).
CREATE TABLE IF NOT EXISTS salon_payment_area (
  salon_id     UUID        NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  area         VARCHAR(20) NOT NULL,
  enabled      BOOLEAN     NOT NULL DEFAULT FALSE,
  -- REDIRECT (Stripe-hosted page), EMBEDDED (Stripe's form on the salon's page) or ELEMENTS
  -- (the salon's own branded payment form).
  checkout_ui  VARCHAR(20) NOT NULL DEFAULT 'REDIRECT',
  updated_at   TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (salon_id, area)
);

INSERT INTO salon_payment_area (salon_id, area, enabled, checkout_ui, updated_at)
SELECT salon_id, 'SHOP', shop_enabled, 'REDIRECT', updated_at FROM salon_payment_settings
ON CONFLICT (salon_id, area) DO NOTHING;
INSERT INTO salon_payment_area (salon_id, area, enabled, checkout_ui, updated_at)
SELECT salon_id, 'BOOKING', booking_enabled, 'REDIRECT', updated_at FROM salon_payment_settings
ON CONFLICT (salon_id, area) DO NOTHING;
INSERT INTO salon_payment_area (salon_id, area, enabled, checkout_ui, updated_at)
SELECT salon_id, 'POS', pos_enabled, 'REDIRECT', updated_at FROM salon_payment_settings
ON CONFLICT (salon_id, area) DO NOTHING;
INSERT INTO salon_payment_area (salon_id, area, enabled, checkout_ui, updated_at)
SELECT salon_id, 'MEMBERSHIP', membership_enabled, 'REDIRECT', updated_at FROM salon_payment_settings
ON CONFLICT (salon_id, area) DO NOTHING;

-- One row per attempt to take money (a Checkout Session or a Terminal PaymentIntent), whatever
-- module asked for it. Feature modules keep their own status; this is what refunds, the owner's
-- transaction list and reconciliation work from.
CREATE TABLE IF NOT EXISTS payment (
  id                   BIGSERIAL     PRIMARY KEY,
  salon_id             UUID          NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  area                 VARCHAR(20)   NOT NULL,
  reference            VARCHAR(120)  NOT NULL,
  -- CHECKOUT or TERMINAL
  channel              VARCHAR(20)   NOT NULL,
  checkout_ui          VARCHAR(20),
  -- PENDING, SUCCEEDED, FAILED, CANCELED, PARTIALLY_REFUNDED, REFUNDED
  status               VARCHAR(30)   NOT NULL DEFAULT 'PENDING',
  amount               NUMERIC(12,2) NOT NULL,
  currency             VARCHAR(3)    NOT NULL,
  amount_refunded      NUMERIC(12,2) NOT NULL DEFAULT 0,
  description          VARCHAR(255),
  customer_email       VARCHAR(255),
  checkout_session_id  VARCHAR(255)  UNIQUE,
  payment_intent_id    VARCHAR(255)  UNIQUE,
  terminal_id          BIGINT,
  failure_message      VARCHAR(500),
  created_at           TIMESTAMPTZ   NOT NULL,
  updated_at           TIMESTAMPTZ   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_salon_created ON payment (salon_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payment_area_reference ON payment (salon_id, area, reference);

CREATE TABLE IF NOT EXISTS payment_refund (
  id                BIGSERIAL     PRIMARY KEY,
  payment_id        BIGINT        NOT NULL REFERENCES payment(id) ON DELETE CASCADE,
  salon_id          UUID          NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  stripe_refund_id  VARCHAR(255)  UNIQUE,
  amount            NUMERIC(12,2) NOT NULL,
  currency          VARCHAR(3)    NOT NULL,
  -- Stripe's refund status: pending, requires_action, succeeded, failed, canceled
  status            VARCHAR(30)   NOT NULL,
  reason            VARCHAR(500),
  requested_by      VARCHAR(255),
  created_at        TIMESTAMPTZ   NOT NULL,
  updated_at        TIMESTAMPTZ   NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_payment_refund_payment ON payment_refund (payment_id);
