ALTER TABLE organizations ADD COLUMN is_partner INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN referred_by_partner_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL;
ALTER TABLE organizations ADD COLUMN partner_assigned_at TEXT NOT NULL DEFAULT '';
CREATE INDEX organizations_partner_referrals ON organizations(referred_by_partner_id);
