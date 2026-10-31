-- Platform announcements written by super-admins. SALON_OWNERS shows in the salon admin app only,
-- ALL_APPS shows in every frontend app.
CREATE TABLE IF NOT EXISTS announcement (
    id         BIGSERIAL PRIMARY KEY,
    title      TEXT        NOT NULL,
    message    TEXT        NOT NULL,
    severity   VARCHAR(20) NOT NULL DEFAULT 'INFO',
    audience   VARCHAR(20) NOT NULL DEFAULT 'SALON_OWNERS',
    link_url   TEXT,
    link_label TEXT,
    starts_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    ends_at    TIMESTAMPTZ,
    active     BOOLEAN     NOT NULL DEFAULT TRUE,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT announcement_severity_chk CHECK (severity IN ('INFO', 'WARNING', 'CRITICAL')),
    CONSTRAINT announcement_audience_chk CHECK (audience IN ('SALON_OWNERS', 'ALL_APPS'))
);
CREATE INDEX IF NOT EXISTS idx_announcement_active ON announcement(active, starts_at, ends_at);
