CREATE TABLE IF NOT EXISTS saloon_holiday (
    id            BIGSERIAL PRIMARY KEY,
    saloon_id     UUID        NOT NULL REFERENCES saloon(id) ON DELETE CASCADE,
    name          VARCHAR(100) NOT NULL,
    holiday_month SMALLINT    NOT NULL CHECK (holiday_month BETWEEN 1 AND 12),
    holiday_day   SMALLINT    NOT NULL CHECK (holiday_day   BETWEEN 1 AND 31),
    end_month     SMALLINT    CHECK (end_month BETWEEN 1 AND 12),
    end_day       SMALLINT    CHECK (end_day   BETWEEN 1 AND 31),
    year          INT,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_saloon_holiday_saloon_id ON saloon_holiday(saloon_id);

-- For existing installations where the table was created without end_month/end_day
ALTER TABLE saloon_holiday
    ADD COLUMN IF NOT EXISTS end_month SMALLINT CHECK (end_month BETWEEN 1 AND 12),
    ADD COLUMN IF NOT EXISTS end_day   SMALLINT CHECK (end_day   BETWEEN 1 AND 31);

ALTER TABLE saloon_closure ADD COLUMN IF NOT EXISTS holiday_id BIGINT REFERENCES saloon_holiday(id) ON DELETE CASCADE;

ALTER TABLE saloon ADD COLUMN IF NOT EXISTS booking_requires_confirmation BOOLEAN NOT NULL DEFAULT false;
