CREATE TABLE `background_jobs` (
	`key` text PRIMARY KEY NOT NULL,
	`day` text DEFAULT '' NOT NULL,
	`cursor` integer DEFAULT 0 NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL,
	`lease_until` text DEFAULT '' NOT NULL,
	`failures` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint

ALTER TABLE `memberships` ADD `scheduled_disable_at` text DEFAULT '' NOT NULL;--> statement-breakpoint

ALTER TABLE `organizations` ADD `scheduled_disable_at` text DEFAULT '' NOT NULL;