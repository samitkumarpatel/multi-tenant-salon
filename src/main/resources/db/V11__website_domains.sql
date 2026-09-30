CREATE TABLE IF NOT EXISTS website_domain (
    id UUID PRIMARY KEY,
    salon_id UUID NOT NULL UNIQUE REFERENCES salon(id),
    hostname VARCHAR(253) NOT NULL UNIQUE,
    verification_token VARCHAR(64) NOT NULL,
    provider_id VARCHAR(64),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING_DNS',
    message VARCHAR(500),
    verified_at TIMESTAMPTZ,
    active_until TIMESTAMPTZ,
    checked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (hostname = lower(hostname)),
    CHECK (status IN ('PENDING_DNS', 'PROVISIONING', 'ACTIVE', 'ERROR', 'DELETING'))
);
CREATE INDEX IF NOT EXISTS website_domain_checked_at_idx ON website_domain(checked_at);
