ALTER TABLE salon
    ADD COLUMN IF NOT EXISTS terms_accepted    BOOLEAN     NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;

UPDATE super_admin SET email = 'admin@salonsaas.org' WHERE email = 'admin@my-salon.online';

ALTER TABLE booking
    ALTER COLUMN customer_email DROP NOT NULL;
