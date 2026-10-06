CREATE TABLE salon_policy_document (
    salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
    policy_key VARCHAR(80) NOT NULL,
    draft_document TEXT NOT NULL,
    published_document TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    published_at TIMESTAMPTZ,
    PRIMARY KEY (salon_id, policy_key)
);

ALTER TABLE dashboard_settings DROP COLUMN IF EXISTS notifications_enabled;
ALTER TABLE dashboard_settings DROP COLUMN IF EXISTS default_notification;
