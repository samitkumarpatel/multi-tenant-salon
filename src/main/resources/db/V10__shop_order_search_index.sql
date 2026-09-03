-- Backs the paginated / sortable admin orders list: the common access path is
-- "this salon's orders, newest first, one page at a time".
CREATE INDEX IF NOT EXISTS idx_shop_order_salon_created_at
    ON shop_order (salon_id, created_at DESC);
