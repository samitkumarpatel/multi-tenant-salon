-- Products whose current handle has no live product_handle row (e.g. created before V37) 404'd on the
-- public product page, which resolves through product_handle. Re-point / create the missing rows.
INSERT INTO product_handle(salon_id, handle, product_id)
  SELECT salon_id, handle, id FROM product
  ON CONFLICT (salon_id, handle) DO UPDATE SET product_id = EXCLUDED.product_id
  WHERE product_handle.product_id IS NULL;
