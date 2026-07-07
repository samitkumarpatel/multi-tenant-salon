CREATE TABLE IF NOT EXISTS saloon (
  id              BIGSERIAL    PRIMARY KEY,
  name            VARCHAR(255) NOT NULL,
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
  saloon_id  BIGINT      NOT NULL REFERENCES saloon(id) ON DELETE CASCADE,
  saloon_key INTEGER,
  day        VARCHAR(20) NOT NULL,
  open_time  VARCHAR(10),
  close_time VARCHAR(10),
  closed     BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS saloon_feature (
  saloon_id  BIGINT      NOT NULL REFERENCES saloon(id) ON DELETE CASCADE,
  saloon_key INTEGER,
  feature    VARCHAR(50) NOT NULL
);

CREATE TABLE IF NOT EXISTS service_item (
  id               BIGSERIAL    PRIMARY KEY,
  saloon_id        BIGINT       NOT NULL REFERENCES saloon(id),
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
  saloon_id  BIGINT       NOT NULL REFERENCES saloon(id),
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
