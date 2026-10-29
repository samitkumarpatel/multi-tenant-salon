-- Keep every current and former URL reserved within its salon, including after deletion.
ALTER TABLE product ADD COLUMN IF NOT EXISTS handle VARCHAR(100);
CREATE TABLE IF NOT EXISTS product_handle (
  salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  handle VARCHAR(100) NOT NULL,
  product_id BIGINT REFERENCES product(id) ON DELETE SET NULL,
  PRIMARY KEY (salon_id, handle)
);
CREATE INDEX IF NOT EXISTS product_handle_product_idx ON product_handle(product_id);

-- Stable, deterministic backfill; rerunning never changes an assigned handle.
WITH RECURSIVE normalized AS (
  SELECT id,salon_id,trim(both '-' from left(regexp_replace(
    translate(replace(replace(replace(lower(name),'æ','ae'),'œ','oe'),'ß','ss'),
              'àáâãäåāèéêëēìíîïīòóôõöøōùúûüūýÿçñ','aaaaaaaeeeeeiiiiiooooooouuuuuyycn'),
    '[^a-z0-9]+','-','g'),80)) base,
    row_number() OVER (PARTITION BY salon_id ORDER BY id) rn
  FROM product WHERE handle IS NULL
), allocated(salon_id,rn,product_id,handle,used) AS (
  SELECT DISTINCT n.salon_id,0::bigint,NULL::bigint,NULL::text,
    ARRAY(SELECT handle FROM product WHERE salon_id=n.salon_id AND handle IS NOT NULL
          UNION SELECT handle FROM product_handle WHERE salon_id=n.salon_id)::text[]
  FROM normalized n
  UNION ALL
  SELECT n.salon_id,n.rn,n.id,c.candidate,a.used || c.candidate
  FROM allocated a JOIN normalized n ON n.salon_id=a.salon_id AND n.rn=a.rn+1
  CROSS JOIN LATERAL (
    SELECT COALESCE(NULLIF(n.base,''),'product') || CASE WHEN suffix=1 THEN '' ELSE '-' || suffix END candidate
    FROM generate_series(1,cardinality(a.used)+1) suffix
    WHERE NOT (COALESCE(NULLIF(n.base,''),'product') || CASE WHEN suffix=1 THEN '' ELSE '-' || suffix END = ANY(a.used))
    ORDER BY suffix LIMIT 1
  ) c
)
UPDATE product p SET handle=a.handle FROM allocated a WHERE p.id=a.product_id;
ALTER TABLE product ALTER COLUMN handle SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS product_salon_handle_idx ON product(salon_id,handle);
INSERT INTO product_handle(salon_id,handle,product_id)
  SELECT salon_id,handle,id FROM product ON CONFLICT DO NOTHING;
