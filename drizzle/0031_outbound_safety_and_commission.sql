-- Additive safeguards and auditable subscription commission terms.
ALTER TABLE organizations ADD COLUMN outbound_commission_months INTEGER NOT NULL DEFAULT 12;
ALTER TABLE organizations ADD COLUMN outbound_market_rules TEXT NOT NULL DEFAULT '{}';
ALTER TABLE outbound_lead_state ADD COLUMN lease_token TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_lead_state ADD COLUMN lease_until TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_company_ownership ADD COLUMN lease_token TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_company_ownership ADD COLUMN lease_until TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_call_logs ADD COLUMN request_id TEXT NOT NULL DEFAULT '';
CREATE UNIQUE INDEX outbound_call_request_unique ON outbound_call_logs(organization_id,request_id) WHERE request_id <> '';
ALTER TABLE outbound_deals ADD COLUMN customer_company_id INTEGER;
ALTER TABLE outbound_deals ADD COLUMN subscription_activated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_deals ADD COLUMN subscription_cancelled_at TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_deals ADD COLUMN commission_months INTEGER NOT NULL DEFAULT 12;
ALTER TABLE outbound_deals ADD COLUMN commission_agreed_at TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_deal_payments ADD COLUMN received_at TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_deal_payments ADD COLUMN refund_payment_id INTEGER;
ALTER TABLE outbound_deal_payments ADD COLUMN commission_amount_minor INTEGER NOT NULL DEFAULT 0;
ALTER TABLE outbound_deal_payments ADD COLUMN payment_reference_key TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_deal_payments ADD COLUMN created_by_membership_id INTEGER NOT NULL DEFAULT 0;
UPDATE outbound_deal_payments SET received_at=created_at, commission_amount_minor=round(paid_amount_minor * commission_bps / 10000.0), payment_reference_key=lower(trim(payment_reference));
-- Preserve existing recorded receipts: resolve historic reference case variants by retaining each historic ID.
UPDATE outbound_deal_payments SET payment_reference_key=payment_reference_key || ':legacy:' || id
WHERE id NOT IN (SELECT MIN(id) FROM outbound_deal_payments GROUP BY organization_id,payment_reference_key);
CREATE UNIQUE INDEX outbound_payment_key_unique ON outbound_deal_payments(organization_id,payment_reference_key) WHERE payment_reference_key <> '';
CREATE INDEX outbound_payment_refund ON outbound_deal_payments(organization_id,refund_payment_id);
ALTER TABLE outbound_lead_state ADD COLUMN contact_permission INTEGER NOT NULL DEFAULT 0;

-- Enforce the received-cash ledger at the database boundary, including racing refunds.
-- Refund amounts and salesperson/currency attribution must come from the original receipt.
CREATE TRIGGER outbound_payment_insert_guard BEFORE INSERT ON outbound_deal_payments
BEGIN
  SELECT (CASE WHEN
    typeof(NEW.paid_amount_minor) <> 'integer' OR
    typeof(NEW.commission_amount_minor) <> 'integer' OR
    typeof(NEW.commission_bps) <> 'integer' OR
    NEW.paid_amount_minor = 0 OR abs(NEW.paid_amount_minor) > 10000000000 OR
    abs(NEW.commission_amount_minor) > abs(NEW.paid_amount_minor) OR
    NEW.commission_bps < 0 OR NEW.commission_bps > 10000 OR
    NEW.payment_reference_key = '' OR NEW.received_at = ''
    THEN RAISE(ABORT, 'invalid received-payment ledger entry') END);
  SELECT (CASE WHEN NEW.refund_payment_id IS NULL AND
    (NEW.paid_amount_minor < 0 OR NEW.commission_amount_minor < 0)
    THEN RAISE(ABORT, 'negative receipt requires an original refund payment') END);
  SELECT (CASE WHEN NEW.refund_payment_id IS NOT NULL AND
    (NEW.paid_amount_minor > 0 OR NEW.commission_amount_minor > 0 OR NOT EXISTS (
      SELECT 1 FROM outbound_deal_payments p WHERE p.id = NEW.refund_payment_id
        AND p.refund_payment_id IS NULL AND p.paid_amount_minor > 0
        AND p.organization_id = NEW.organization_id AND p.entry_id = NEW.entry_id
        AND p.membership_id = NEW.membership_id AND p.currency = NEW.currency
        AND p.commission_bps = NEW.commission_bps AND p.received_at <= NEW.received_at
    )) THEN RAISE(ABORT, 'refund must retain its original payment attribution') END);
  WITH balance AS (
    SELECT p.paid_amount_minor AS original_amount, p.commission_amount_minor AS original_commission,
      -NEW.paid_amount_minor - coalesce((SELECT sum(r.paid_amount_minor)
        FROM outbound_deal_payments r WHERE r.refund_payment_id = p.id), 0) AS refunded_amount,
      -NEW.commission_amount_minor - coalesce((SELECT sum(r.commission_amount_minor)
        FROM outbound_deal_payments r WHERE r.refund_payment_id = p.id), 0) AS reversed_commission
    FROM outbound_deal_payments p WHERE p.id = NEW.refund_payment_id
  ), exact_ratio AS (
    -- Split the multiplication to stay below SQLite's signed 64-bit integer limit.
    SELECT *, refunded_amount * (original_commission / 10000) AS scaled_amount,
      refunded_amount * (original_commission % 10000) AS remainder_amount
    FROM balance
  )
  SELECT (CASE WHEN refunded_amount > original_amount OR reversed_commission <> (
    (scaled_amount / original_amount) * 10000 +
    (((scaled_amount % original_amount) * 10000 + remainder_amount) * 2 + original_amount) / (original_amount * 2)
  ) THEN RAISE(ABORT, 'refund exceeds remaining balance or commission changed; reload before retrying') END)
  FROM exact_ratio;
END;
ALTER TABLE organizations ADD COLUMN outbound_playbooks TEXT NOT NULL DEFAULT '{}';
ALTER TABLE outbound_deals ADD COLUMN demo_attended_at TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_deals ADD COLUMN trial_activated_at TEXT NOT NULL DEFAULT '';
ALTER TABLE outbound_call_logs ADD COLUMN request_fingerprint TEXT NOT NULL DEFAULT '';

-- Receipt attribution and the agreed financial basis remain immutable once cash exists.
-- Cancellation is deliberately editable to stop future accrual.
CREATE TRIGGER outbound_deal_financial_terms_guard BEFORE UPDATE ON outbound_deals
WHEN (NEW.organization_id IS NOT OLD.organization_id
  OR NEW.entry_id IS NOT OLD.entry_id
  OR NEW.membership_id IS NOT OLD.membership_id
  OR NEW.customer_company_id IS NOT OLD.customer_company_id
  OR NEW.customer_organization_id IS NOT OLD.customer_organization_id
  OR NEW.currency IS NOT OLD.currency
  OR NEW.commission_bps IS NOT OLD.commission_bps
  OR NEW.commission_months IS NOT OLD.commission_months
  OR NEW.commission_agreed_at IS NOT OLD.commission_agreed_at
  OR NEW.subscription_activated_at IS NOT OLD.subscription_activated_at)
 AND EXISTS (SELECT 1 FROM outbound_deal_payments p
  WHERE p.organization_id = OLD.organization_id AND p.entry_id = OLD.entry_id)
BEGIN SELECT RAISE(ABORT, 'outbound financial terms are frozen after received cash'); END;
