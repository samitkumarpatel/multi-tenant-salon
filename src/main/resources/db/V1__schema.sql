CREATE TABLE IF NOT EXISTS event_publication
(
    id                     UUID NOT NULL,
    listener_id            TEXT NOT NULL,
    event_type             TEXT NOT NULL,
    serialized_event       TEXT NOT NULL,
    publication_date       TIMESTAMP WITH TIME ZONE NOT NULL,
    completion_date        TIMESTAMP WITH TIME ZONE,
    status                 TEXT,
    completion_attempts    INT,
    last_resubmission_date TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id)
);
CREATE INDEX IF NOT EXISTS event_publication_serialized_event_hash_idx ON event_publication USING hash(serialized_event);
CREATE INDEX IF NOT EXISTS event_publication_by_completion_date_idx ON event_publication (completion_date);

CREATE TABLE IF NOT EXISTS salon (
  id                       UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  name                     VARCHAR(255) NOT NULL,
  handler                  VARCHAR(255) NOT NULL UNIQUE,
  owner_name               VARCHAR(255),
  owner_email              VARCHAR(255),
  owner_phone              VARCHAR(50),
  address                  VARCHAR(500),
  city                     VARCHAR(100),
  state                    VARCHAR(100),
  country                  VARCHAR(100),
  zip_code                 VARCHAR(20),
  contact_phone            VARCHAR(50),
  contact_email            VARCHAR(255),
  contact_website          VARCHAR(500),
  booking_advance_days     INTEGER      NOT NULL DEFAULT 60,
  business_registration_id VARCHAR(100),
  show_business_id         BOOLEAN      NOT NULL DEFAULT FALSE,
  business_id_label        VARCHAR(100),
  created_at               TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS salon_operating_hours (
  salon_id  UUID        NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  salon_key INTEGER,
  day        VARCHAR(20) NOT NULL,
  open_time  VARCHAR(10),
  close_time VARCHAR(10),
  closed     BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS salon_feature (
  salon_id  UUID        NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  salon_key INTEGER,
  feature    VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS service_item (
  id               BIGSERIAL    PRIMARY KEY,
  salon_id        UUID         NOT NULL REFERENCES salon(id),
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
  id                    BIGSERIAL    PRIMARY KEY,
  salon_id             UUID         NOT NULL REFERENCES salon(id),
  name                  VARCHAR(255) NOT NULL,
  email                 VARCHAR(255),
  phone                 VARCHAR(50),
  role                  VARCHAR(50)  NOT NULL,
  status                VARCHAR(50)  NOT NULL,
  is_owner              BOOLEAN      NOT NULL DEFAULT FALSE,
  available_for_booking BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ  NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_member_specialization (
  staff_member_id  BIGINT       NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  staff_member_key INTEGER,
  value            VARCHAR(255) NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_availability (
  id          BIGSERIAL    PRIMARY KEY,
  salon_id   UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  staff_id    BIGINT       NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  day_of_week VARCHAR(10)  NOT NULL,
  start_time  TIME         NOT NULL,
  end_time    TIME         NOT NULL,
  available   BOOLEAN      NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS staff_availability_override (
  id            BIGSERIAL    PRIMARY KEY,
  salon_id     UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  staff_id      BIGINT       NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  override_date DATE         NOT NULL,
  start_time    TIME,
  end_time      TIME,
  available     BOOLEAN      NOT NULL DEFAULT FALSE,
  reason        VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS booking (
  id               BIGSERIAL    PRIMARY KEY,
  salon_id        UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
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

CREATE TABLE IF NOT EXISTS salon_website_theme (
  salon_id       UUID         PRIMARY KEY REFERENCES salon(id) ON DELETE CASCADE,
  hero_bg         VARCHAR(50)  NOT NULL DEFAULT '#F8FAFC',
  hero_text_color VARCHAR(50)  NOT NULL DEFAULT '#0F172A',
  accent_color    VARCHAR(50)  NOT NULL DEFAULT '#1D4ED8',
  font_family     VARCHAR(100) NOT NULL DEFAULT 'system',
  logo_bg_color   VARCHAR(50)  NOT NULL DEFAULT '#10B981',
  website_mode    VARCHAR(50)  NOT NULL DEFAULT 'STATIC_WEBSITE',
  header_bg       VARCHAR(50)  NOT NULL DEFAULT '#E2E8F0',
  footer_bg       VARCHAR(50)  NOT NULL DEFAULT '#E2E8F0',
  chat_layout     VARCHAR(20)  NOT NULL DEFAULT 'app',
  chat_bg         VARCHAR(50),
  maps_url        TEXT,
  updated_at      TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS salon_closure (
  id          BIGSERIAL    PRIMARY KEY,
  salon_id   UUID         NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  start_date  DATE         NOT NULL,
  end_date    DATE         NOT NULL,
  reason      VARCHAR(255)
);
