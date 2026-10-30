CREATE TABLE IF NOT EXISTS shop_order_communication (
    id BIGSERIAL PRIMARY KEY,
    salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
    order_id BIGINT NOT NULL REFERENCES shop_order(id) ON DELETE CASCADE,
    activity_id BIGINT NOT NULL REFERENCES shop_order_activity(id) ON DELETE CASCADE,
    source_activity_id BIGINT REFERENCES shop_order_activity(id) ON DELETE SET NULL,
    source_line_activity_id BIGINT REFERENCES shop_order_line_activity(id) ON DELETE SET NULL,
    recipient TEXT,
    recipient_name TEXT,
    html_body TEXT,
    failure_reason TEXT,
    generation INT NOT NULL DEFAULT 0,
    attempts INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_order_communication_order ON shop_order_communication(salon_id, order_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_communication_source ON shop_order_communication(source_activity_id) WHERE source_activity_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_order_communication_line_source ON shop_order_communication(source_line_activity_id) WHERE source_line_activity_id IS NOT NULL;
CREATE TABLE IF NOT EXISTS shop_order_communication_attempt (
    id BIGSERIAL PRIMARY KEY,
    communication_id BIGINT NOT NULL REFERENCES shop_order_communication(id) ON DELETE CASCADE,
    generation INT NOT NULL,
    status TEXT NOT NULL,
    failure_reason TEXT,
    started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_communication_attempt ON shop_order_communication_attempt(communication_id, id);
