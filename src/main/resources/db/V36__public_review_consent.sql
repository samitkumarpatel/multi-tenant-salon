-- Consent is opt-in. Existing written feedback remains private, including after restarts.
ALTER TABLE booking_review ADD COLUMN IF NOT EXISTS public_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE booking_review ADD COLUMN IF NOT EXISTS public_hidden BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customer_feedback ADD COLUMN IF NOT EXISTS public_consent BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE customer_feedback ADD COLUMN IF NOT EXISTS public_hidden BOOLEAN NOT NULL DEFAULT false;
