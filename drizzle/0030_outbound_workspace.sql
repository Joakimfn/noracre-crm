-- Outbound workspace is optional; existing CRM clients remain unchanged.
ALTER TABLE organizations ADD COLUMN outbound_enabled INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN outbound_currency TEXT NOT NULL DEFAULT 'NOK';
ALTER TABLE organizations ADD COLUMN outbound_timezone TEXT NOT NULL DEFAULT 'Europe/Oslo';
ALTER TABLE organizations ADD COLUMN outbound_commission_bps INTEGER NOT NULL DEFAULT 0;
ALTER TABLE organizations ADD COLUMN outbound_pitch TEXT NOT NULL DEFAULT '';

CREATE TABLE outbound_lead_state (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 organization_id INTEGER NOT NULL,
 entry_id INTEGER NOT NULL UNIQUE,
 assigned_membership_id INTEGER NOT NULL DEFAULT 0,
 next_call_at TEXT NOT NULL DEFAULT '',
 pipeline TEXT NOT NULL DEFAULT 'Prospekt',
 last_outcome TEXT NOT NULL DEFAULT '',
 last_note TEXT NOT NULL DEFAULT '',
 contact_name TEXT NOT NULL DEFAULT '',
 contact_phone TEXT NOT NULL DEFAULT '',
 attempts INTEGER NOT NULL DEFAULT 0,
 do_not_contact INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX outbound_lead_owner ON outbound_lead_state(organization_id, assigned_membership_id);
CREATE INDEX outbound_lead_followup ON outbound_lead_state(organization_id,next_call_at);

CREATE TABLE outbound_call_logs (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 organization_id INTEGER NOT NULL,
 entry_id INTEGER NOT NULL,
 membership_id INTEGER NOT NULL,
 outcome TEXT NOT NULL,
 note TEXT NOT NULL DEFAULT '',
 next_call_at TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL
);
CREATE INDEX outbound_calls_reporting ON outbound_call_logs(organization_id,created_at);
CREATE INDEX outbound_calls_lead ON outbound_call_logs(organization_id,entry_id);

CREATE TABLE outbound_deals (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 organization_id INTEGER NOT NULL,
 entry_id INTEGER NOT NULL UNIQUE,
 membership_id INTEGER NOT NULL,
 customer_organization_id INTEGER,
 pipeline TEXT NOT NULL DEFAULT 'Demo booket',
 monthly_amount_minor INTEGER NOT NULL DEFAULT 0,
 currency TEXT NOT NULL DEFAULT 'NOK',
 commission_bps INTEGER NOT NULL DEFAULT 0,
 payment_reference TEXT NOT NULL DEFAULT '',
 payment_confirmed_at TEXT NOT NULL DEFAULT '',
 note TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL
);
CREATE INDEX outbound_deal_org ON outbound_deals(organization_id,membership_id);

CREATE TABLE outbound_suppression (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 organization_id INTEGER NOT NULL,
 country TEXT NOT NULL,
 org_number TEXT NOT NULL,
 name TEXT NOT NULL DEFAULT '',
 created_by_membership_id INTEGER NOT NULL,
 reason TEXT NOT NULL DEFAULT '',
 created_at TEXT NOT NULL,
 UNIQUE(organization_id,country,org_number)
);
