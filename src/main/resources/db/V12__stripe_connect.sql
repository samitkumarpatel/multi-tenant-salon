-- One Stripe Connect account per salon. Payment enablement is tracked independently
-- for the Shop, Booking, and dashboard Till / POS surfaces.
CREATE TABLE IF NOT EXISTS stripe_connected_account (
  salon_id UUID PRIMARY KEY REFERENCES salon(id) ON DELETE CASCADE,
  stripe_account_id VARCHAR(80) NOT NULL UNIQUE,
  country VARCHAR(2) NOT NULL,
  details_submitted BOOLEAN NOT NULL DEFAULT FALSE,
  charges_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  payouts_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS salon_payment_settings (
  salon_id UUID PRIMARY KEY REFERENCES salon(id) ON DELETE CASCADE,
  shop_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  booking_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  pos_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  booking_payment_type VARCHAR(20) NOT NULL DEFAULT 'FULL',
  booking_deposit_percent INTEGER NOT NULL DEFAULT 20,
  updated_at TIMESTAMPTZ NOT NULL
);

ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'PAID';
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120);
ALTER TABLE booking ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'NOT_REQUIRED';
ALTER TABLE booking ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(120);
