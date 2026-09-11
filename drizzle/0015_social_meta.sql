CREATE TABLE social_oauth (
 id TEXT PRIMARY KEY NOT NULL, organization_id INTEGER NOT NULL, membership_id INTEGER NOT NULL,
 state_hash TEXT NOT NULL, browser_hash TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'waiting',
 payload TEXT NOT NULL DEFAULT '', expires_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX social_oauth_state ON social_oauth(state_hash);
CREATE INDEX social_oauth_expiry ON social_oauth(expires_at);
CREATE TABLE social_connections (
 id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, organization_id INTEGER NOT NULL, platform TEXT NOT NULL,
 account_id TEXT NOT NULL, account_name TEXT NOT NULL, page_id TEXT NOT NULL, token TEXT NOT NULL,
 expires_at INTEGER NOT NULL, connected_by INTEGER NOT NULL, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX social_connection_org_platform ON social_connections(organization_id, platform);
CREATE TABLE social_deliveries (
 id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, organization_id INTEGER NOT NULL, post_id INTEGER NOT NULL,
 platform TEXT NOT NULL, account_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'sending',
 remote_id TEXT NOT NULL DEFAULT '', error TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX social_delivery_once ON social_deliveries(organization_id, post_id, platform);
