CREATE TABLE `activities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`company_id` integer NOT NULL,
	`company_name` text DEFAULT '' NOT NULL,
	`kind` text NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`due_at` text DEFAULT '' NOT NULL,
	`completed_at` text DEFAULT '' NOT NULL,
	`created_by` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_activities_company_id` ON `activities` (`company_id`);--> statement-breakpoint
CREATE INDEX `idx_activities_due_at` ON `activities` (`due_at`);--> statement-breakpoint
CREATE TABLE `audit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`actor` text NOT NULL,
	`action` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `team_members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`role` text DEFAULT 'Bruker' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
ALTER TABLE `companies` ADD `assigned_to` text DEFAULT 'Joakim' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `last_contact_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `companies` ADD `synced_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_companies_next_action_date` ON `companies` (`next_action_date`);--> statement-breakpoint
CREATE INDEX `idx_companies_stage` ON `companies` (`stage`);