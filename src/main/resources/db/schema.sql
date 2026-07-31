CREATE TABLE IF NOT EXISTS saloon (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name            VARCHAR(255) NOT NULL,
  handler         VARCHAR(255) NOT NULL UNIQUE,
  owner_name      VARCHAR(255),
  owner_email     VARCHAR(255),
  owner_phone     VARCHAR(50),
  address         VARCHAR(500),
  city            VARCHAR(100),
  state           VARCHAR(100),
  country         VARCHAR(100),
  zip_code        VARCHAR(20),
  contact_phone   VARCHAR(50),
  contact_email   VARCHAR(255),
  contact_website VARCHAR(500),
  created_at      TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS saloon_operating_hours (
  saloon_id  UUID        NOT NULL REFERENCES saloon(id) ON DELETE CASCADE,
  saloon_key INTEGER,
  day        VARCHAR(20) NOT NULL,
  open_time  VARCHAR(10),
  close_time VARCHAR(10),
  closed     BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS saloon_feature (
  saloon_id  UUID        NOT NULL REFERENCES saloon(id) ON DELETE CASCADE,
  saloon_key INTEGER,
  feature    VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS service_item (
  id               BIGSERIAL    PRIMARY KEY,
  saloon_id        UUID         NOT NULL REFERENCES saloon(id),
  name             VARCHAR(255) NOT NULL,
  description      TEXT,
  price            NUMERIC(10, 2),
  currency         VARCHAR(3),
  duration_minutes INTEGER,
  category         VARCHAR(50)  NOT NULL,
  active           BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS service_item_assigned_staff (
  service_item_id  BIGINT       NOT NULL REFERENCES service_item(id) ON DELETE CASCADE,
  service_item_key INTEGER,
  staff_id         VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_member (
  id         BIGSERIAL    PRIMARY KEY,
  saloon_id  UUID         NOT NULL REFERENCES saloon(id),
  name       VARCHAR(255) NOT NULL,
  email      VARCHAR(255),
  phone      VARCHAR(50),
  role       VARCHAR(50)  NOT NULL,
  status     VARCHAR(50)  NOT NULL,
  created_at TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_member_specialization (
  staff_member_id  BIGINT       NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  staff_member_key INTEGER,
  value            VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_availability (
  id          BIGSERIAL    PRIMARY KEY,
  saloon_id   UUID         NOT NULL REFERENCES saloon(id) ON DELETE CASCADE,
  staff_id    BIGINT       NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  day_of_week VARCHAR(10)  NOT NULL,
  start_time  TIME         NOT NULL,
  end_time    TIME         NOT NULL,
  available   BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS staff_availability_override (
  id            BIGSERIAL    PRIMARY KEY,
  saloon_id     UUID         NOT NULL REFERENCES saloon(id) ON DELETE CASCADE,
  staff_id      BIGINT       NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  override_date DATE         NOT NULL,
  start_time    TIME,
  end_time      TIME,
  available     BOOLEAN      NOT NULL DEFAULT FALSE,
  reason        VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS booking (
  id               BIGSERIAL    PRIMARY KEY,
  saloon_id        UUID         NOT NULL REFERENCES saloon(id) ON DELETE CASCADE,
  service_id       BIGINT       NOT NULL REFERENCES service_item(id) ON DELETE CASCADE,
  staff_id         BIGINT       NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  customer_name    VARCHAR(255) NOT NULL,
  customer_email   VARCHAR(255) NOT NULL,
  customer_phone   VARCHAR(50),
  appointment_date DATE         NOT NULL,
  start_time       TIME         NOT NULL,
  end_time         TIME         NOT NULL,
  status           VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
  notes            TEXT,
  created_at       TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS saloon_website_theme (
  saloon_id       UUID         PRIMARY KEY REFERENCES saloon(id) ON DELETE CASCADE,
  hero_bg         VARCHAR(50)  NOT NULL DEFAULT '#F8FAFC',
  hero_text_color VARCHAR(50)  NOT NULL DEFAULT '#0F172A',
  accent_color    VARCHAR(50)  NOT NULL DEFAULT '#1D4ED8',
  font_family     VARCHAR(100) NOT NULL DEFAULT 'system',
  logo_bg_color   VARCHAR(50)  NOT NULL DEFAULT '#10B981',
  website_mode    VARCHAR(50)  NOT NULL DEFAULT 'STATIC_WEBSITE',
  header_bg       VARCHAR(50)  NOT NULL DEFAULT '#E2E8F0',
  footer_bg       VARCHAR(50)  NOT NULL DEFAULT '#E2E8F0',
  maps_url        TEXT,
  updated_at      TIMESTAMPTZ
);

ALTER TABLE saloon_website_theme ADD COLUMN IF NOT EXISTS website_mode VARCHAR(50) NOT NULL DEFAULT 'STATIC_WEBSITE';
ALTER TABLE saloon_website_theme ALTER COLUMN website_mode SET DEFAULT 'STATIC_WEBSITE';

UPDATE saloon_website_theme SET website_mode =
  CASE website_mode
    WHEN 'static'  THEN 'STATIC_WEBSITE'
    WHEN 'ai'      THEN 'GENERATIVE_UI'
    WHEN 'contact' THEN 'CUSTOMISE_WEBSITE_CONTACT_US'
    ELSE website_mode
  END
WHERE website_mode IN ('static', 'ai', 'contact');
ALTER TABLE saloon_website_theme ADD COLUMN IF NOT EXISTS header_bg VARCHAR(50) NOT NULL DEFAULT '#FFFFFF';
ALTER TABLE saloon_website_theme ADD COLUMN IF NOT EXISTS footer_bg VARCHAR(50) NOT NULL DEFAULT '#1E293B';
ALTER TABLE saloon_website_theme ADD COLUMN IF NOT EXISTS maps_url TEXT;
ALTER TABLE saloon_website_theme ADD COLUMN IF NOT EXISTS chat_layout VARCHAR(20) NOT NULL DEFAULT 'app';

ALTER TABLE staff_member ADD COLUMN IF NOT EXISTS is_owner BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE staff_member ADD COLUMN IF NOT EXISTS available_for_booking BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE saloon ADD COLUMN IF NOT EXISTS booking_advance_days INTEGER NOT NULL DEFAULT 60;
ALTER TABLE saloon ADD COLUMN IF NOT EXISTS business_registration_id VARCHAR(100);
ALTER TABLE saloon ADD COLUMN IF NOT EXISTS show_business_id BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE saloon ADD COLUMN IF NOT EXISTS business_id_label VARCHAR(100);

CREATE TABLE IF NOT EXISTS saloon_closure (
  id          BIGSERIAL    PRIMARY KEY,
  saloon_id   UUID         NOT NULL REFERENCES saloon(id) ON DELETE CASCADE,
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  reason      VARCHAR(255)
);
