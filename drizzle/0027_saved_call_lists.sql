ALTER TABLE organizations ADD COLUMN operating_countries TEXT NOT NULL DEFAULT '["NO"]';
ALTER TABLE companies ADD COLUMN country TEXT NOT NULL DEFAULT 'NO';
ALTER TABLE call_list_entries ADD COLUMN list_id INTEGER;
ALTER TABLE call_list_entries ADD COLUMN country TEXT NOT NULL DEFAULT 'NO';
CREATE TABLE saved_call_lists (id INTEGER PRIMARY KEY AUTOINCREMENT, organization_id INTEGER NOT NULL, name TEXT NOT NULL, country TEXT NOT NULL DEFAULT 'NO', created_by_membership_id INTEGER NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL);
CREATE INDEX idx_saved_lists_org ON saved_call_lists(organization_id,id);
CREATE TABLE call_list_assignments (id INTEGER PRIMARY KEY AUTOINCREMENT, organization_id INTEGER NOT NULL, list_id INTEGER NOT NULL, membership_id INTEGER NOT NULL, assigned_by TEXT NOT NULL, created_at TEXT NOT NULL, acknowledged_at TEXT NOT NULL DEFAULT '');
CREATE UNIQUE INDEX idx_list_assignment_unique ON call_list_assignments(list_id,membership_id);
CREATE INDEX idx_list_assignment_member ON call_list_assignments(organization_id,membership_id);
CREATE INDEX idx_call_entries_list ON call_list_entries(organization_id,list_id,status);
-- Preserve each existing company's queue and history as a named shared legacy list.
INSERT INTO saved_call_lists(organization_id,name,country,created_by_membership_id,created_at,updated_at) SELECT DISTINCT organization_id,'Tidligere ringeliste','NO',0,strftime('%Y-%m-%dT%H:%M:%fZ','now'),strftime('%Y-%m-%dT%H:%M:%fZ','now') FROM call_list_entries;
UPDATE call_list_entries SET list_id=(SELECT id FROM saved_call_lists WHERE saved_call_lists.organization_id=call_list_entries.organization_id AND created_by_membership_id=0 LIMIT 1);
