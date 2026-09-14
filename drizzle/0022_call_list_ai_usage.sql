CREATE TABLE call_list_ai_usage (
 membership_id INTEGER PRIMARY KEY REFERENCES memberships(id) ON DELETE CASCADE,
 window_started INTEGER NOT NULL,
 count INTEGER NOT NULL DEFAULT 0
);
