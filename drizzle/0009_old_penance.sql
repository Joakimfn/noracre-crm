PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`theme` text DEFAULT 'light' NOT NULL,
	`avatar_key` text DEFAULT '' NOT NULL,
	`avatar_type` text DEFAULT '' NOT NULL,
	`avatar_x` integer DEFAULT 50 NOT NULL,
	`avatar_y` integer DEFAULT 50 NOT NULL,
	`avatar_zoom` integer DEFAULT 100 NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
INSERT INTO `__new_user_profiles`("user_id", "display_name", "contact_email", "theme", "avatar_key", "avatar_type", "avatar_x", "avatar_y", "avatar_zoom", "updated_at") SELECT "user_id", "display_name", "contact_email", CASE WHEN "theme" IN ('light','dark','system') THEN "theme" ELSE 'light' END, "avatar_key", "avatar_type", 50, 50, 100, "updated_at" FROM `user_profiles`;--> statement-breakpoint
DROP TABLE `user_profiles`;--> statement-breakpoint
ALTER TABLE `__new_user_profiles` RENAME TO `user_profiles`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
ALTER TABLE `call_list_entries` ADD `meeting_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `call_list_entries` ADD `customer_id` integer;--> statement-breakpoint
ALTER TABLE `call_list_entries` ADD `contact_name` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `call_list_entries` ADD `contact_email` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `call_list_entries` ADD `contact_phone` text DEFAULT '' NOT NULL;
