ALTER TABLE organizations ADD COLUMN commission_bps INTEGER CHECK(commission_bps IS NULL OR (commission_bps BETWEEN 0 AND 10000 AND typeof(commission_bps)='integer'));
CREATE TABLE partner_payments(id INTEGER PRIMARY KEY AUTOINCREMENT,organization_id INTEGER NOT NULL,partner_id INTEGER NOT NULL,company_name TEXT NOT NULL,reference TEXT NOT NULL,reference_key TEXT NOT NULL,paid_on TEXT NOT NULL,amount_ore INTEGER NOT NULL CHECK(amount_ore>0 AND amount_ore<=1000000000),basis_points INTEGER NOT NULL CHECK(basis_points BETWEEN 0 AND 10000),commission_ore INTEGER NOT NULL,created_at TEXT NOT NULL,created_by TEXT NOT NULL,voided_at TEXT NOT NULL DEFAULT '');
CREATE UNIQUE INDEX partner_payment_reference ON partner_payments(organization_id,reference_key);
CREATE INDEX partner_payment_partner ON partner_payments(partner_id,paid_on);
-- Preserve the agreed rate and referral at registration, even if either changes later.
CREATE TRIGGER partner_payment_validate BEFORE INSERT ON partner_payments BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM organizations c JOIN organizations p ON p.id=c.referred_by_partner_id WHERE c.id=NEW.organization_id AND p.id=NEW.partner_id AND p.is_partner=1 AND p.commission_bps=NEW.basis_points) THEN RAISE(ABORT,'Partner agreement changed; reload before registering payment') END;
END;
