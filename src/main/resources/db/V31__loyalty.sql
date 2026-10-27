-- Loyalty programme (LOYALTY_PROGRAM feature): points earned on completed appointments and paid shop orders,
-- redeemed for owner-defined rewards. Balances are always SUM(loyalty_ledger.delta) — the ledger is insert-only.
CREATE TABLE IF NOT EXISTS loyalty_program (
  salon_id UUID PRIMARY KEY REFERENCES salon(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  points_per_unit NUMERIC(8,2) NOT NULL DEFAULT 1 CHECK (points_per_unit >= 0),
  earn_on_bookings BOOLEAN NOT NULL DEFAULT TRUE,
  earn_on_orders BOOLEAN NOT NULL DEFAULT TRUE,
  expiry_months INTEGER CHECK (expiry_months IS NULL OR expiry_months BETWEEN 1 AND 120),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS loyalty_reward (
  id BIGSERIAL PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  name VARCHAR(120) NOT NULL,
  description TEXT,
  points_cost INTEGER NOT NULL CHECK (points_cost > 0),
  reward_type VARCHAR(24) NOT NULL,
  reward_value NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_reward_salon_idx ON loyalty_reward (salon_id);

CREATE TABLE IF NOT EXISTS loyalty_ledger (
  id BIGSERIAL PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  email VARCHAR(254) NOT NULL,
  delta INTEGER NOT NULL,
  reason VARCHAR(24) NOT NULL,
  source_type VARCHAR(24),
  source_id VARCHAR(64),
  note TEXT,
  actor VARCHAR(254),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS loyalty_ledger_customer_idx ON loyalty_ledger (salon_id, email);
-- One row per (reason, source): redelivered events cannot earn twice. NULL sources (manual adjustments) never clash.
CREATE UNIQUE INDEX IF NOT EXISTS loyalty_ledger_source_uq ON loyalty_ledger (salon_id, reason, source_type, source_id);

CREATE TABLE IF NOT EXISTS loyalty_redemption (
  id BIGSERIAL PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  reward_id BIGINT REFERENCES loyalty_reward(id) ON DELETE SET NULL,
  reward_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  points INTEGER NOT NULL,
  code VARCHAR(16) NOT NULL,
  status VARCHAR(12) NOT NULL DEFAULT 'ISSUED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  used_at TIMESTAMPTZ,
  used_by VARCHAR(254),
  UNIQUE (salon_id, code)
);
CREATE INDEX IF NOT EXISTS loyalty_redemption_customer_idx ON loyalty_redemption (salon_id, email);
