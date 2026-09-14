-- Existing dates stay as drafts; only explicit confirmation queues publication.
ALTER TABLE marketing_posts ADD COLUMN scheduled_membership_id INTEGER NOT NULL DEFAULT 0;
ALTER TABLE marketing_posts ADD COLUMN scheduled_targets TEXT NOT NULL DEFAULT '[]';
ALTER TABLE marketing_posts ADD COLUMN publication_error TEXT NOT NULL DEFAULT '';
CREATE INDEX idx_marketing_posts_due ON marketing_posts(status,scheduled_at);
