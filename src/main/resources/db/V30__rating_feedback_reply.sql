-- Free-text feedback written by the customer (immutable once submitted) and the salon owner's reply to it.
ALTER TABLE booking_review ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE booking_review ADD COLUMN IF NOT EXISTS reply TEXT;
ALTER TABLE booking_review ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;
