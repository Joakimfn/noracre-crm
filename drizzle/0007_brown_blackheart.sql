CREATE TABLE `call_list_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`org_number` text DEFAULT '' NOT NULL,
	`name` text NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`employees` integer,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`website` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'Ny' NOT NULL,
	`source` text DEFAULT 'Brønnøysundregistrene' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_call_list_entries_org_created` ON `call_list_entries` (`organization_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_call_list_entries_org_status` ON `call_list_entries` (`organization_id`,`status`);--> statement-breakpoint
CREATE TABLE `offer_templates` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`name` text NOT NULL,
	`subject` text DEFAULT '' NOT NULL,
	`body` text DEFAULT '' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_offer_templates_org` ON `offer_templates` (`organization_id`,`id`);--> statement-breakpoint
CREATE TABLE `organization_modules` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`module_key` text NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`price_per_user` integer DEFAULT 49 NOT NULL,
	`activated_at` text NOT NULL,
	`deactivated_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_organization_modules_org_key` ON `organization_modules` (`organization_id`,`module_key`);--> statement-breakpoint
ALTER TABLE `organizations` ADD `deactivated_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `organizations` ADD `retain_until` text DEFAULT '' NOT NULL;