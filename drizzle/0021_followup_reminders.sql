ALTER TABLE activities ADD COLUMN reminder_minutes TEXT NOT NULL DEFAULT '[15]';
ALTER TABLE companies ADD COLUMN import_id TEXT NOT NULL DEFAULT '';
ALTER TABLE companies ADD COLUMN import_source TEXT NOT NULL DEFAULT '';
CREATE TABLE data_imports (id TEXT PRIMARY KEY NOT NULL, organization_id INTEGER NOT NULL, fingerprint TEXT NOT NULL, result TEXT NOT NULL, created_at TEXT NOT NULL);
