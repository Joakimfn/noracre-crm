CREATE TABLE `marketing_posts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`content` text NOT NULL,
	`platforms` text DEFAULT '[]' NOT NULL,
	`scheduled_at` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Kladd' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_marketing_posts_org_scheduled` ON `marketing_posts` (`organization_id`,`scheduled_at`);--> statement-breakpoint
ALTER TABLE `call_list_entries` ADD `handled_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user_profiles` ADD `browser_notifications` integer DEFAULT false NOT NULL;