-- Customer self-service accounts (phase 1: sign-in + read-only history). A customer proves they
-- control an email address for one salon with a one-time code, and that session unlocks every
-- booking, order and membership the salon holds under that address. No customer table: the
-- existing rows are keyed by their customer_email. Every statement is idempotent — the whole schema
-- is re-applied on each startup (spring.sql.init.mode: always).

-- One row per sign-in request, including those for addresses the salon doesn't know (code_hash
-- NULL: never verifiable, but counted by the per-email and per-IP rate limits). Only a hash of the
-- code is kept.
CREATE TABLE IF NOT EXISTS customer_sign_in_code (
  id           BIGSERIAL    PRIMARY KEY,
  salon_id     UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  email        VARCHAR(254) NOT NULL,
  code_hash    VARCHAR(64),
  client_ip    VARCHAR(64),
  attempts     INTEGER      NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ  NOT NULL,
  consumed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_customer_sign_in_code_email ON customer_sign_in_code(salon_id, email, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_customer_sign_in_code_ip ON customer_sign_in_code(client_ip, created_at DESC);

-- A signed-in customer. The bearer token is only ever stored as its SHA-256; a session is scoped to
-- one (salon, email) and can be revoked (sign-out) before it expires.
CREATE TABLE IF NOT EXISTS customer_session (
  id            BIGSERIAL    PRIMARY KEY,
  salon_id      UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  email         VARCHAR(254) NOT NULL,
  token_hash    VARCHAR(64)  NOT NULL UNIQUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  expires_at    TIMESTAMPTZ  NOT NULL,
  last_seen_at  TIMESTAMPTZ,
  revoked_at    TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_customer_session_email ON customer_session(salon_id, email);

-- The account view selects each area by (salon, lower(email)). Membership already has this index (V18).
CREATE INDEX IF NOT EXISTS idx_booking_customer_email ON booking(salon_id, lower(customer_email));
CREATE INDEX IF NOT EXISTS idx_shop_order_customer_email ON shop_order(salon_id, lower(customer_email));
