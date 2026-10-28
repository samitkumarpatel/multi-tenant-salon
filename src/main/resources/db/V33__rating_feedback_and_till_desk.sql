-- ---- rating_separate_feedback
-- Written feedback is now given separately about the salon and about the stylist (the single `feedback`
-- text before this covered both). Existing text is carried over as the salon feedback; the old column is
-- left in place (unused) because these scripts run on every startup and a plain script can't drop it safely.
ALTER TABLE booking_review ADD COLUMN IF NOT EXISTS salon_feedback TEXT;
ALTER TABLE booking_review ADD COLUMN IF NOT EXISTS staff_feedback TEXT;
UPDATE booking_review SET salon_feedback = feedback
 WHERE feedback IS NOT NULL AND salon_feedback IS NULL AND staff_feedback IS NULL;

-- ---- pos_sale_tip_discount
-- A till sale can carry a discount and a tip. `total` stays what the customer pays
-- (subtotal - discount_amount + tip_amount), so card checkout, refunds and the day sheet are unchanged.
-- Rows from before this change have no subtotal; they read as subtotal = total.
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS subtotal        NUMERIC(12, 2);
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS discount_reason VARCHAR(255);
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS tip_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- ---- pos_sale_customer_and_reward
-- A till sale can name the customer by email (so loyalty points can be earned) and carry the loyalty
-- reward code that was spent on it (so the reward goes back if the sale fails or is voided).
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS customer_email        VARCHAR(254);
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS loyalty_redemption_id BIGINT;

-- ---- membership_benefit_use
-- Included services a member has used at the till in a billing cycle (cycle_end = the subscription's
-- current_period_end when used, so a renewal starts a fresh allowance). Released when the sale is voided.
CREATE TABLE IF NOT EXISTS membership_benefit_use (
  id              BIGSERIAL PRIMARY KEY,
  salon_id        UUID        NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  subscription_id BIGINT      NOT NULL REFERENCES membership_subscription(id) ON DELETE CASCADE,
  cycle_end       TIMESTAMPTZ NOT NULL,
  service_id      BIGINT      NOT NULL,
  quantity        INTEGER     NOT NULL CHECK (quantity > 0),
  sale_id         BIGINT      NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_membership_benefit_use_cycle ON membership_benefit_use (subscription_id, cycle_end, service_id);
CREATE INDEX IF NOT EXISTS idx_membership_benefit_use_sale ON membership_benefit_use (salon_id, sale_id);

-- ---- till_shift
-- A cash-drawer shift: opened with a float, closed with the counted cash. Expected cash is the float plus the
-- cash taken since it opened; it is stored at close so the difference never changes afterwards.
CREATE TABLE IF NOT EXISTS till_shift (
  id            BIGSERIAL PRIMARY KEY,
  salon_id      UUID           NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  currency      VARCHAR(3)     NOT NULL,
  opening_float NUMERIC(12, 2) NOT NULL CHECK (opening_float >= 0),
  opened_by     VARCHAR(254),
  opened_at     TIMESTAMPTZ    NOT NULL DEFAULT now(),
  closed_by     VARCHAR(254),
  closed_at     TIMESTAMPTZ,
  counted_cash  NUMERIC(12, 2),
  expected_cash NUMERIC(12, 2),
  note          TEXT
);
-- One open drawer per salon.
CREATE UNIQUE INDEX IF NOT EXISTS uq_till_shift_open ON till_shift (salon_id) WHERE closed_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_till_shift_salon ON till_shift (salon_id, opened_at DESC);

-- ---- walk_in_queue
-- Customers who walked in without an appointment and are waiting at the desk.
CREATE TABLE IF NOT EXISTS walk_in (
  id            BIGSERIAL PRIMARY KEY,
  salon_id      UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  customer_name VARCHAR(255) NOT NULL,
  phone         VARCHAR(40),
  service_id    BIGINT,
  staff_id      BIGINT,
  note          VARCHAR(500),
  status        VARCHAR(10)  NOT NULL DEFAULT 'WAITING',
  created_by    VARCHAR(254),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_walk_in_waiting ON walk_in (salon_id, created_at) WHERE status = 'WAITING';

