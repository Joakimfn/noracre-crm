CREATE TABLE IF NOT EXISTS website_enquiries (
 request_id TEXT PRIMARY KEY,
 fingerprint TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'pending',
 created_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS website_enquiry_limits (
 key TEXT PRIMARY KEY,
 count INTEGER NOT NULL,
 expires_at INTEGER NOT NULL
);
