CREATE TABLE IF NOT EXISTS login_audit_event (
  id BIGSERIAL PRIMARY KEY,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  email_snapshot VARCHAR(254) NOT NULL,
  identity_verified BOOLEAN NOT NULL,
  application VARCHAR(32) NOT NULL,
  method VARCHAR(32) NOT NULL,
  result VARCHAR(32) NOT NULL,
  salon_id UUID REFERENCES salon(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_login_audit_email_time ON login_audit_event(lower(email_snapshot), occurred_at DESC, id DESC);
