CREATE TABLE `module_licenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`membership_id` integer NOT NULL,
	`module_key` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`price_per_user` integer DEFAULT 49 NOT NULL,
	`activated_at` text NOT NULL,
	`deactivated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_module_licenses_member_key` ON `module_licenses` (`organization_id`,`membership_id`,`module_key`);--> statement-breakpoint
CREATE INDEX `idx_module_licenses_org_active` ON `module_licenses` (`organization_id`,`module_key`,`active`);--> statement-breakpoint
CREATE TABLE `user_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`display_name` text DEFAULT '' NOT NULL,
	`contact_email` text DEFAULT '' NOT NULL,
	`theme` text DEFAULT 'system' NOT NULL,
	`avatar_key` text DEFAULT '' NOT NULL,
	`avatar_type` text DEFAULT '' NOT NULL,
	`updated_at` text NOT NULL
);
