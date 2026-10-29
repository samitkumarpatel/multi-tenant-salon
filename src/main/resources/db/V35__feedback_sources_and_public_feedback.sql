-- Historical entry points cannot be inferred reliably.
ALTER TABLE booking_review ADD COLUMN IF NOT EXISTS source VARCHAR(40) NOT NULL DEFAULT 'LEGACY';
ALTER TABLE booking_review ALTER COLUMN salon_rating DROP NOT NULL;
ALTER TABLE booking_review ALTER COLUMN staff_rating DROP NOT NULL;

CREATE TABLE IF NOT EXISTS feedback_settings (
  salon_id UUID PRIMARY KEY REFERENCES salon(id) ON DELETE CASCADE,
  public_website_enabled BOOLEAN NOT NULL DEFAULT true
);

-- General feedback is separate from verified, booking-bound reviews.
CREATE TABLE IF NOT EXISTS customer_feedback (
  id BIGSERIAL PRIMARY KEY,
  salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  staff_id BIGINT REFERENCES staff_member(id) ON DELETE SET NULL,
  customer_name VARCHAR(120),
  salon_rating SMALLINT CHECK (salon_rating BETWEEN 1 AND 5),
  staff_rating SMALLINT CHECK (staff_rating BETWEEN 1 AND 5),
  salon_feedback VARCHAR(1000),
  staff_feedback VARCHAR(1000),
  source VARCHAR(40) NOT NULL,
  receipt_hash VARCHAR(64) NOT NULL UNIQUE,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reply VARCHAR(1000),
  replied_at TIMESTAMPTZ,
  CHECK (salon_rating IS NOT NULL OR staff_rating IS NOT NULL OR salon_feedback IS NOT NULL OR staff_feedback IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS customer_feedback_salon_idx ON customer_feedback(salon_id, submitted_at DESC);
