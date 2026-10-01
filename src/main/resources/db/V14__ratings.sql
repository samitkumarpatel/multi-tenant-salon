CREATE TABLE IF NOT EXISTS rating_invitation (
  booking_id BIGINT PRIMARY KEY REFERENCES booking(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_review (
  booking_id BIGINT PRIMARY KEY REFERENCES booking(id) ON DELETE CASCADE,
  salon_id UUID NOT NULL REFERENCES salon(id) ON DELETE CASCADE,
  staff_id BIGINT NOT NULL REFERENCES staff_member(id) ON DELETE CASCADE,
  salon_rating SMALLINT NOT NULL CHECK (salon_rating BETWEEN 1 AND 5),
  staff_rating SMALLINT NOT NULL CHECK (staff_rating BETWEEN 1 AND 5),
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS booking_review_salon_idx ON booking_review (salon_id);
CREATE INDEX IF NOT EXISTS booking_review_staff_idx ON booking_review (salon_id, staff_id);
