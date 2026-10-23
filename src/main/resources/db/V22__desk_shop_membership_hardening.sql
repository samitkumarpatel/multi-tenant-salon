-- Hardening the desk, the shop and memberships. One migration rather than four: none of these had
-- reached main, so there is no history to preserve. Every statement is idempotent (IF NOT EXISTS).

-- ── Shop: put an order's stock back at most once ────────────────────────────
-- Marks the moment an order's items went back on the shelf. A cancellation, a received return
-- and a failed payment can all reach the restock path for the same order, so the restock claims
-- this column with a conditional UPDATE (... WHERE stock_restored_at IS NULL) and only the first
-- claimant moves stock. Without it, cancelling an order whose payment had already failed would
-- credit the same quantity twice.
ALTER TABLE shop_order ADD COLUMN IF NOT EXISTS stock_restored_at TIMESTAMPTZ;

-- ── Memberships: refunding a payment ────────────────────────────────────────
-- The money movement itself lives in the payments module's ledger (payment / payment_refund); these
-- columns are the membership module's own record of how much of this period's charge has been given
-- back, so the member's Payments panel and the owner's "collected this month" figure can tell a
-- refunded period from a paid one.
--
-- refunded_amount is the running total given back, so repeated partial refunds accumulate and the
-- conditional UPDATE that writes it can cap at the amount charged.
ALTER TABLE membership_payment ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12,2);
ALTER TABLE membership_payment ADD COLUMN IF NOT EXISTS refunded_at     TIMESTAMPTZ;
ALTER TABLE membership_payment ADD COLUMN IF NOT EXISTS refund_reason   TEXT;

-- The overview's "collected this month" and "recent activity" both scan by salon; without these they
-- are sequential scans that degrade as *other* salons grow.
CREATE INDEX IF NOT EXISTS idx_membership_payment_salon_paid
    ON membership_payment (salon_id, status, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_membership_activity_salon_created
    ON membership_activity (salon_id, created_at DESC);

-- ── Till: correcting and de-duplicating sales ───────────────────────────────
-- idempotency_key: the till generates one per cart. Without it a lost response (flaky salon wifi, the
-- client's 55s abort) leaves the operator no way to tell "it didn't go through" from "the reply
-- didn't come back", and re-ringing creates a second sale, a second stock decrement and, on card, a
-- second charge. Unique per salon so a replay returns the original sale instead of making a new one.
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS idempotency_key VARCHAR(80);
CREATE UNIQUE INDEX IF NOT EXISTS uq_pos_sale_idempotency
    ON pos_sale (salon_id, idempotency_key) WHERE idempotency_key IS NOT NULL;

-- Voiding a sale rung up wrong. Until now a till sale was permanent: wrong total, stock gone, no
-- reversal and no way to give the money back. voided_at doubles as the once-only guard, the same way
-- shop_order.stock_restored_at does, so a void can't put stock back twice.
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS voided_at       TIMESTAMPTZ;
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS void_reason     TEXT;
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS refunded_amount NUMERIC(12, 2);

-- The sweeper that fails card sales abandoned at the counter asks "which sales are PENDING and older
-- than N minutes?" across every salon at once, every few minutes. Pending sales are a handful at any
-- moment, so a partial index keeps this to those few rows instead of a scan of the whole table. It is
-- only usable while the query spells the status as the literal 'PENDING', which it does.
CREATE INDEX IF NOT EXISTS idx_pos_sale_pending
    ON pos_sale (created_at) WHERE payment_status = 'PENDING';

-- ── Till: who rang a sale up, and who reversed it ───────────────────────────
-- Until now a till sale carried only a customer name and a total, and every membership desk sale was
-- recorded with the literal actor "desk". When a drawer is short at close there was nothing to show
-- who took which payment, so the dispute could not be settled and shift reconciliation was
-- impossible. The sign-in email is what the auth server puts in the token's subject, and it is stable
-- across a staff member's lifetime at the salon, so that is what is stored.
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS created_by VARCHAR(254);
ALTER TABLE pos_sale ADD COLUMN IF NOT EXISTS voided_by  VARCHAR(254);

-- No new index for the end-of-day report: it filters on (salon_id, created_at range), which the
-- existing idx_pos_sale_salon_created (V10) already serves. Checked with EXPLAIN on 40,000 rows — the
-- planner picks that one, and an index added for the report was never chosen.
