-- Membership plans a salon sells on its public website, paid through the salon's Stripe Connect
-- account like the shop and till. Written to be re-runnable (spring.sql.init runs it on every start).

ALTER TABLE salon_payment_settings ADD COLUMN IF NOT EXISTS membership_enabled BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS membership_plan (
  id                       BIGSERIAL     PRIMARY KEY,
  salon_id                 UUID          NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  name                     VARCHAR(160)  NOT NULL,
  description              TEXT,
  price                    NUMERIC(12,2) NOT NULL,
  currency                 VARCHAR(3)    NOT NULL,
  billing_interval         VARCHAR(20)   NOT NULL,
  signup_fee               NUMERIC(12,2),
  service_discount_percent INTEGER,
  product_discount_percent INTEGER,
  max_members              INTEGER,
  highlighted              BOOLEAN       NOT NULL DEFAULT FALSE,
  sort_order               INTEGER       NOT NULL DEFAULT 0,
  status                   VARCHAR(20)   NOT NULL DEFAULT 'DRAFT',
  created_at               TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_membership_plan_salon ON membership_plan(salon_id, status);

-- Ordered free-text perks ("Priority booking", "Free drink every visit").
CREATE TABLE IF NOT EXISTS membership_plan_perk (
  plan_id  BIGINT       NOT NULL REFERENCES membership_plan(id) ON DELETE CASCADE,
  sort_key INTEGER      NOT NULL,
  value    VARCHAR(300) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_membership_plan_perk_plan ON membership_plan_perk(plan_id);

-- Services included every billing cycle; a deleted service simply drops out of the plan.
CREATE TABLE IF NOT EXISTS membership_plan_service (
  plan_id            BIGINT  NOT NULL REFERENCES membership_plan(id) ON DELETE CASCADE,
  sort_key           INTEGER NOT NULL,
  service_id         BIGINT  NOT NULL REFERENCES service_item(id) ON DELETE CASCADE,
  quantity_per_cycle INTEGER NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS idx_membership_plan_service_plan ON membership_plan_service(plan_id);

-- One member's membership of a plan. Price/interval are snapshotted at purchase so a later plan
-- edit never changes what an existing member pays; a plan with members can only be archived.
-- Paid like the shop and till: every period is a one-time Stripe Checkout (payment area
-- MEMBERSHIP) that extends current_period_end; renewal_token is the secret in the renewal link.
CREATE TABLE IF NOT EXISTS membership_subscription (
  id                    BIGSERIAL     PRIMARY KEY,
  salon_id              UUID          NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  plan_id               BIGINT        NOT NULL REFERENCES membership_plan(id) ON DELETE RESTRICT,
  plan_name             VARCHAR(160)  NOT NULL,
  member_code           VARCHAR(20)   NOT NULL UNIQUE,
  renewal_token         VARCHAR(64)   NOT NULL UNIQUE,
  customer_name         VARCHAR(160)  NOT NULL,
  customer_email        VARCHAR(254)  NOT NULL,
  customer_phone        VARCHAR(40),
  status                VARCHAR(20)   NOT NULL,
  price                 NUMERIC(12,2) NOT NULL,
  currency              VARCHAR(3)    NOT NULL,
  billing_interval      VARCHAR(20)   NOT NULL,
  signup_fee            NUMERIC(12,2),
  source                VARCHAR(20)   NOT NULL DEFAULT 'ONLINE',
  started_at            TIMESTAMPTZ,
  current_period_end    TIMESTAMPTZ,
  cancel_at_period_end  BOOLEAN       NOT NULL DEFAULT FALSE,
  cancelled_at          TIMESTAMPTZ,
  cancel_reason         VARCHAR(500),
  ended_at              TIMESTAMPTZ,
  renewal_reminder_for  TIMESTAMPTZ,
  last_payment_status   VARCHAR(20),
  last_payment_at       TIMESTAMPTZ,
  last_payment_amount   NUMERIC(12,2),
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_membership_subscription_salon ON membership_subscription(salon_id, status);
CREATE INDEX IF NOT EXISTS idx_membership_subscription_plan ON membership_subscription(plan_id);
CREATE INDEX IF NOT EXISTS idx_membership_subscription_email ON membership_subscription(salon_id, lower(customer_email));
CREATE INDEX IF NOT EXISTS idx_membership_subscription_period_end ON membership_subscription(status, current_period_end);

-- One Stripe Checkout per period (sign-up or renewal). Its id is the checkout's payment_reference;
-- only a PENDING row moves, so webhook redeliveries are harmless.
CREATE TABLE IF NOT EXISTS membership_payment (
  id                  BIGSERIAL     PRIMARY KEY,
  subscription_id     BIGINT        NOT NULL REFERENCES membership_subscription(id) ON DELETE CASCADE,
  salon_id            UUID          NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  kind                VARCHAR(20)   NOT NULL,
  status              VARCHAR(20)   NOT NULL,
  amount              NUMERIC(12,2) NOT NULL,
  currency            VARCHAR(3)    NOT NULL,
  checkout_session_id VARCHAR(120),
  period_start        TIMESTAMPTZ,
  period_end          TIMESTAMPTZ,
  paid_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ   NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_membership_payment_subscription ON membership_payment(subscription_id);

-- Insert-only timeline per subscription (created, paid, cancelled, emails sent, staff notes).
CREATE TABLE IF NOT EXISTS membership_activity (
  id              BIGSERIAL    PRIMARY KEY,
  subscription_id BIGINT       NOT NULL REFERENCES membership_subscription(id) ON DELETE CASCADE,
  salon_id        UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  type            VARCHAR(40)  NOT NULL,
  message         TEXT         NOT NULL,
  actor           VARCHAR(120) NOT NULL,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_membership_activity_subscription ON membership_activity(subscription_id, created_at);
