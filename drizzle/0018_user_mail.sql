-- User mailbox grants are private to one organization membership.
CREATE TABLE mail_accounts (organization_id INTEGER NOT NULL, membership_id INTEGER NOT NULL, provider TEXT NOT NULL, email TEXT NOT NULL, token TEXT NOT NULL, updated_at INTEGER NOT NULL, PRIMARY KEY(organization_id,membership_id));
CREATE TABLE mail_oauth (state TEXT PRIMARY KEY NOT NULL, organization_id INTEGER NOT NULL, membership_id INTEGER NOT NULL, browser_hash TEXT NOT NULL, provider TEXT NOT NULL, verifier TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting', expires_at INTEGER NOT NULL);
CREATE INDEX mail_oauth_expiry ON mail_oauth(expires_at);
CREATE TABLE mail_attempts (id TEXT PRIMARY KEY NOT NULL, status TEXT NOT NULL, created_at INTEGER NOT NULL);
