-- Dashboard configuration and point-of-sale persistence.
CREATE TABLE IF NOT EXISTS dashboard_settings (
  salon_id                    UUID PRIMARY KEY REFERENCES salon(id) ON DELETE CASCADE,
  booking_management_enabled BOOLEAN     NOT NULL DEFAULT TRUE,
  cashier_enabled            BOOLEAN     NOT NULL DEFAULT TRUE,
  notifications_enabled      BOOLEAN     NOT NULL DEFAULT TRUE,
  default_notification       TEXT,
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS pos_sale (
  id             BIGSERIAL      PRIMARY KEY,
  salon_id       UUID           NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  sale_number    VARCHAR(40)    NOT NULL,
  customer_name  VARCHAR(255),
  payment_method VARCHAR(20)    NOT NULL,
  total          NUMERIC(12, 2) NOT NULL,
  currency       VARCHAR(3)     NOT NULL,
  created_at     TIMESTAMPTZ    NOT NULL,
  UNIQUE (salon_id, sale_number)
);
CREATE INDEX IF NOT EXISTS idx_pos_sale_salon_created ON pos_sale(salon_id, created_at DESC);

CREATE TABLE IF NOT EXISTS pos_sale_line (
  id          BIGSERIAL      PRIMARY KEY,
  sale_id     BIGINT         NOT NULL REFERENCES pos_sale(id) ON DELETE CASCADE,
  sale_key    INTEGER,
  source_type VARCHAR(20)    NOT NULL,
  source_id   BIGINT         NOT NULL,
  item_name   VARCHAR(255)   NOT NULL,
  unit_price  NUMERIC(10, 2) NOT NULL,
  quantity    INTEGER        NOT NULL,
  line_total  NUMERIC(12, 2) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pos_sale_line_sale ON pos_sale_line(sale_id);
