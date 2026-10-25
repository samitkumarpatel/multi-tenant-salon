-- The salon's own customer record (the owner's customer list). Until now a customer was only an email
-- repeated on bookings, orders and memberships; this row is what the owner edits, annotates and erases.
-- History rows stay keyed by their customer_email — nothing here changes how the customer's own
-- account (sign-in + history) finds them. Every statement is idempotent — the whole schema is
-- re-applied on each startup (spring.sql.init.mode: always).

CREATE TABLE IF NOT EXISTS salon_customer (
  id            BIGSERIAL    PRIMARY KEY,
  salon_id      UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  name          VARCHAR(255) NOT NULL,
  email         VARCHAR(254) NOT NULL,
  phone         VARCHAR(50),
  notes         TEXT,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  last_seen_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_salon_customer_email ON salon_customer(salon_id, lower(email));
CREATE INDEX IF NOT EXISTS idx_salon_customer_last_seen ON salon_customer(salon_id, last_seen_at DESC);

-- Backfill from the history the salon already holds: one row per (salon, email), with the name and
-- phone of the most recent row that has them. Erasing a customer rewrites their history emails to
-- *@anonymized.invalid, which is also what keeps this statement from bringing an erased customer back
-- on the next startup.
INSERT INTO salon_customer (salon_id, name, email, phone, created_at, updated_at, last_seen_at)
SELECT DISTINCT ON (salon_id, lower(email))
       salon_id, name, email, phone, seen_at, seen_at, seen_at
FROM (
  SELECT salon_id, customer_name AS name, customer_email AS email, customer_phone AS phone, created_at AS seen_at
  FROM booking
  UNION ALL
  SELECT salon_id, customer_name, customer_email, customer_phone, created_at
  FROM shop_order
  WHERE payment_status NOT IN ('FAILED', 'VOIDED')
  UNION ALL
  SELECT salon_id, customer_name, customer_email, customer_phone, created_at
  FROM membership_subscription
  WHERE status <> 'INCOMPLETE'
) history
WHERE email IS NOT NULL
  AND btrim(email) <> ''
  AND lower(email) NOT LIKE '%@anonymized.invalid'
ORDER BY salon_id, lower(email), seen_at DESC
ON CONFLICT DO NOTHING;
