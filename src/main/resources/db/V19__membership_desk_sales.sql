-- Memberships sold at the salon desk (Till / POS) can be paid in cash or another way on the spot,
-- not only through Stripe Checkout. Existing rows were all Stripe card payments.
-- Re-runnable (spring.sql.init runs it on every start).
ALTER TABLE membership_payment ADD COLUMN IF NOT EXISTS method VARCHAR(20) NOT NULL DEFAULT 'CARD';
