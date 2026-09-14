ALTER TABLE support_requests ADD COLUMN requested_user_id TEXT NOT NULL DEFAULT '';
ALTER TABLE support_requests ADD COLUMN notification_sent_at TEXT NOT NULL DEFAULT '';
UPDATE support_requests SET status='Utløpt',resolved_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE status='Venter';
