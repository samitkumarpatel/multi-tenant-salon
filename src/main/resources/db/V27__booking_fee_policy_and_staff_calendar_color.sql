-- No-show fee: what the salon charges a customer who does not show up. One optional row per salon: no row
-- means no fee, so every existing salon is covered without a backfill. The fee is collected with a payment
-- link (POST /booking/{id}/payment-link), which uses it as the default amount for a no-show.

CREATE TABLE IF NOT EXISTS booking_fee_policy (
  salon_id          UUID          PRIMARY KEY REFERENCES salon(id) ON DELETE CASCADE,
  no_show_fee_type  VARCHAR(10)   NOT NULL DEFAULT 'NONE' CHECK (no_show_fee_type IN ('NONE', 'PERCENT', 'FIXED')),
  no_show_fee_value NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (no_show_fee_value >= 0),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- The colour a staff member's appointments are drawn in on the booking calendars (desk and admin).
-- Optional: with none chosen the apps fall back to a palette colour. Stored as #RRGGBB.

ALTER TABLE staff_member ADD COLUMN IF NOT EXISTS calendar_color VARCHAR(7);
