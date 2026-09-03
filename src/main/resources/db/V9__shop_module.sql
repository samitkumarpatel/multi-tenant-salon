-- Shop module: per-salon product catalogue (brands, categories, products, variants),
-- inventory (stock counts live on the variant), and customer orders with a per-line
-- activity timeline.

CREATE TABLE IF NOT EXISTS shop_brand (
  id          BIGSERIAL    PRIMARY KEY,
  salon_id    UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url    VARCHAR(1000),
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_brand_salon_id ON shop_brand(salon_id);

CREATE TABLE IF NOT EXISTS shop_category (
  id          BIGSERIAL    PRIMARY KEY,
  salon_id    UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_category_salon_id ON shop_category(salon_id);

CREATE TABLE IF NOT EXISTS product (
  id          BIGSERIAL    PRIMARY KEY,
  salon_id    UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  brand_id    BIGINT       REFERENCES shop_brand(id) ON DELETE SET NULL,
  category_id BIGINT       REFERENCES shop_category(id) ON DELETE SET NULL,
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  image_url   VARCHAR(1000),
  active      BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_salon_id ON product(salon_id);

-- Ordered image gallery for a product. `product.image_url` stays as the cover image
-- (always mirrors images[0]); this child table holds the full list, same shape as
-- staff_member_photo, with the *_key column preserving list order.
CREATE TABLE IF NOT EXISTS product_image (
  product_id  BIGINT        NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  product_key INTEGER,
  value       VARCHAR(1000) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_product_image_product_id ON product_image(product_id);

CREATE TABLE IF NOT EXISTS product_variant (
  id               BIGSERIAL      PRIMARY KEY,
  product_id       BIGINT         NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  salon_id         UUID           NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  sku              VARCHAR(120),
  label            VARCHAR(255),
  price            NUMERIC(10, 2) NOT NULL DEFAULT 0,
  compare_at_price NUMERIC(12, 2),
  currency         VARCHAR(3)     NOT NULL DEFAULT 'USD',
  quantity_on_hand INTEGER        NOT NULL DEFAULT 0,
  reorder_level    INTEGER        NOT NULL DEFAULT 0,
  active           BOOLEAN        NOT NULL DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_product_variant_product_id ON product_variant(product_id);
CREATE INDEX IF NOT EXISTS idx_product_variant_salon_id ON product_variant(salon_id);

CREATE TABLE IF NOT EXISTS shop_order (
  id                BIGSERIAL      PRIMARY KEY,
  salon_id          UUID           NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  order_number      VARCHAR(40)    NOT NULL,
  customer_name     VARCHAR(255)   NOT NULL,
  customer_email    VARCHAR(255)   NOT NULL,
  customer_phone    VARCHAR(50),
  ship_line1        VARCHAR(500),
  ship_line2        VARCHAR(500),
  ship_city         VARCHAR(120),
  ship_state        VARCHAR(120),
  ship_country      VARCHAR(120),
  ship_zip_code     VARCHAR(20),
  status            VARCHAR(20)    NOT NULL DEFAULT 'NEW',
  payment_status    VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
  payment_reference VARCHAR(80),
  subtotal          NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3)     NOT NULL DEFAULT 'USD',
  created_at        TIMESTAMPTZ    NOT NULL,
  tracking_carrier  VARCHAR(80),
  tracking_number   VARCHAR(255)
);
CREATE INDEX IF NOT EXISTS idx_shop_order_salon_id ON shop_order(salon_id);

CREATE TABLE IF NOT EXISTS shop_order_line (
  id            BIGSERIAL      PRIMARY KEY,
  order_id      BIGINT         NOT NULL REFERENCES shop_order(id) ON DELETE CASCADE,
  order_key     INTEGER,
  product_id    BIGINT         REFERENCES product(id) ON DELETE SET NULL,
  variant_id    BIGINT         REFERENCES product_variant(id) ON DELETE SET NULL,
  product_name  VARCHAR(255)   NOT NULL,
  variant_label VARCHAR(255),
  unit_price    NUMERIC(10, 2) NOT NULL DEFAULT 0,
  quantity      INTEGER        NOT NULL DEFAULT 1,
  line_total    NUMERIC(12, 2) NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_shop_order_line_order_id ON shop_order_line(order_id);

CREATE TABLE IF NOT EXISTS shop_order_line_activity (
  id            BIGSERIAL   PRIMARY KEY,
  order_line_id BIGINT      NOT NULL REFERENCES shop_order_line(id) ON DELETE CASCADE,
  salon_id      UUID        NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  type          VARCHAR(30) NOT NULL,
  message       TEXT,
  actor         VARCHAR(120),
  created_at    TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_order_line_activity_line_id ON shop_order_line_activity(order_line_id);

CREATE TABLE IF NOT EXISTS shop_refund (
  id         BIGSERIAL      PRIMARY KEY,
  salon_id   UUID           NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  order_id   BIGINT         NOT NULL REFERENCES shop_order(id) ON DELETE CASCADE,
  amount     NUMERIC(12, 2) NOT NULL,
  reason     TEXT,
  status     VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_refund_salon_id ON shop_refund(salon_id);
CREATE INDEX IF NOT EXISTS idx_shop_refund_order_id ON shop_refund(order_id);

CREATE TABLE IF NOT EXISTS shop_credit_note (
  id         BIGSERIAL      PRIMARY KEY,
  salon_id   UUID           NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  order_id   BIGINT         NOT NULL REFERENCES shop_order(id) ON DELETE CASCADE,
  amount     NUMERIC(12, 2) NOT NULL,
  reason     TEXT,
  reference  VARCHAR(80),
  status     VARCHAR(20)    NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMPTZ    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_credit_note_salon_id ON shop_credit_note(salon_id);
CREATE INDEX IF NOT EXISTS idx_shop_credit_note_order_id ON shop_credit_note(order_id);

-- Order-level activity timeline. CUSTOMER_NOTIFIED rows also carry the actual email the
-- customer received (subject/body/channel/status) — appended by the shop module when the
-- notification module acknowledges a send via OrderCustomerNotifiedEvent.
CREATE TABLE IF NOT EXISTS shop_order_activity (
  id         BIGSERIAL    PRIMARY KEY,
  order_id   BIGINT       NOT NULL REFERENCES shop_order(id) ON DELETE CASCADE,
  salon_id   UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  type       VARCHAR(40)  NOT NULL,
  message    TEXT,
  actor      VARCHAR(120),
  notified   BOOLEAN      NOT NULL DEFAULT FALSE,
  channel    VARCHAR(16),
  subject    VARCHAR(500),
  body       TEXT,
  status     VARCHAR(16),
  created_at TIMESTAMPTZ  NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_shop_order_activity_order_id ON shop_order_activity(order_id);
