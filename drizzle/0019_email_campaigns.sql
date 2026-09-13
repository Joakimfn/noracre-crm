CREATE TABLE IF NOT EXISTS email_campaigns (
 id INTEGER PRIMARY KEY AUTOINCREMENT, organization_id INTEGER NOT NULL, membership_id INTEGER NOT NULL,
 request_key TEXT NOT NULL, fingerprint TEXT NOT NULL, sender TEXT NOT NULL, provider TEXT NOT NULL,
 subject TEXT NOT NULL, message TEXT NOT NULL, recipient_count INTEGER NOT NULL, company_ids TEXT NOT NULL,
 payload_key TEXT NOT NULL, files TEXT NOT NULL DEFAULT '[]', scheduled_at TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'Planlagt', error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL, sent_at TEXT NOT NULL DEFAULT '', hidden INTEGER NOT NULL DEFAULT 0,
 UNIQUE(organization_id,membership_id,request_key));
CREATE INDEX IF NOT EXISTS email_campaigns_due ON email_campaigns(status,scheduled_at);
CREATE INDEX IF NOT EXISTS email_campaigns_org ON email_campaigns(organization_id,hidden,scheduled_at);
