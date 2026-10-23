-- Web-shop shipping: owner-defined shipping methods (Shipmondo-style rules), variant shipping
-- weights for weight-based rules, and per-currency methods. One migration: none of this had
-- reached main. Every statement is idempotent — the whole schema is re-applied on each startup
-- (spring.sql.init.mode: always).

-- ── Variant shipping weight ─────────────────────────────────────────────────
-- Gross shipping weight of one unit in grams (contents + packaging). Required by the product
-- editor, which pre-fills it from the variant's unit (250 ml → ~280 g); see VariantWeights.
ALTER TABLE product_variant ADD COLUMN IF NOT EXISTS weight_grams INTEGER;

-- Backfill variants created before weights existed, using the same estimate as VariantWeights:
-- the measured contents (ml ≈ g) plus 10 % packaging, rounded up to the next 10 g. Labels with no
-- measurable unit ("1 pcs", "Gift set") stay NULL until the owner enters a weight.
UPDATE product_variant v
SET weight_grams = CEIL(m.grams * 1.1 / 10) * 10
FROM (
  SELECT id,
         CAST(REPLACE(parts[1], ',', '.') AS NUMERIC) * CASE LOWER(parts[2])
           WHEN 'ml' THEN 1 WHEN 'g' THEN 1
           WHEN 'l' THEN 1000 WHEN 'kg' THEN 1000
           WHEN 'oz' THEN 28.35 WHEN 'fl oz' THEN 29.57 WHEN 'lb' THEN 453.59
           WHEN 'tablet' THEN 1 WHEN 'capsule' THEN 1 WHEN 'sachet' THEN 15
         END AS grams
  FROM (
    SELECT id, regexp_match(label, '^\s*([0-9]+(?:[.,][0-9]+)?)\s*(fl oz|ml|kg|g|l|oz|lb|tablet|capsule|sachet)\s*$', 'i') AS parts
    FROM product_variant
    WHERE weight_grams IS NULL AND label IS NOT NULL
  ) parsed
  WHERE parts IS NOT NULL
) m
WHERE v.id = m.id AND v.weight_grams IS NULL AND m.grams > 0;

-- ── Shipping methods ────────────────────────────────────────────────────────
-- A method is offered at checkout only when every criterion it sets matches the cart:
-- destination country (none listed = ships everywhere), order value, item count and gross weight
-- ranges (inclusive), and the cart's currency. Its price drops to 0 once the order value reaches
-- free_over.
CREATE TABLE IF NOT EXISTS shop_shipping_method (
  id                 BIGSERIAL      PRIMARY KEY,
  salon_id           UUID           NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  name               VARCHAR(120)   NOT NULL,
  description        TEXT,
  carrier            VARCHAR(80),
  -- HOME (to the door), PICKUP_POINT (parcel shop / locker) or BUSINESS (to a company address)
  delivery_type      VARCHAR(20)    NOT NULL DEFAULT 'HOME',
  price              NUMERIC(12, 2) NOT NULL DEFAULT 0,
  -- The currency price is in; only carts priced in it are offered the method. NULL = the salon's.
  currency           VARCHAR(3),
  free_over          NUMERIC(12, 2),
  min_order_value    NUMERIC(12, 2),
  max_order_value    NUMERIC(12, 2),
  min_items          INT,
  max_items          INT,
  -- Weight bracket, like a carrier's 0–1 kg / 1–5 kg price bands.
  min_weight_grams   INT,
  max_weight_grams   INT,
  min_delivery_days  INT,
  max_delivery_days  INT,
  sort_order         INT            NOT NULL DEFAULT 0,
  active             BOOLEAN        NOT NULL DEFAULT TRUE,
  created_at         TIMESTAMPTZ    NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_shop_shipping_method_salon_id ON shop_shipping_method(salon_id);

-- ISO 3166-1 alpha-2 codes the method ships to. Nothing references these rows, so the
-- aggregate's delete-and-reinsert on save is fine.
CREATE TABLE IF NOT EXISTS shop_shipping_method_country (
  shipping_method_id BIGINT       NOT NULL REFERENCES shop_shipping_method(id) ON DELETE CASCADE,
  country_code       VARCHAR(2)   NOT NULL,
  PRIMARY KEY (shipping_method_id, country_code)
);

-- ── Orders ──────────────────────────────────────────────────────────────────
-- What the customer chose and paid for shipping, snapshotted on the order (the method may be
-- edited or removed later). The amount charged is subtotal + shipping_cost. total_weight_grams is
-- the cart's gross weight, for the shipping label.
ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS shipping_method_id   BIGINT REFERENCES shop_shipping_method(id) ON DELETE SET NULL;
ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS shipping_method_name VARCHAR(160);
ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS shipping_cost        NUMERIC(12, 2) NOT NULL DEFAULT 0;
ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS total_weight_grams   INTEGER;
