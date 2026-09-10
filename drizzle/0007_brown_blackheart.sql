-- Cloudflare recovery: migrations 0002, 0003 and 0005 were uploaded empty
-- and already recorded as applied. Restore their exact schema deltas here,
-- before the still-unapplied 0007. Do not rewrite applied migration history.
CREATE TABLE `contacts` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`company_id` integer NOT NULL,
	`name` text NOT NULL,
	`title` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`is_primary` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_contacts_org_company` ON `contacts` (`organization_id`,`company_id`);--> statement-breakpoint
CREATE TABLE `memberships` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`user_id` text NOT NULL,
	`email` text NOT NULL,
	`name` text NOT NULL,
	`role` text DEFAULT 'Bruker' NOT NULL,
	`active` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_memberships_user_org` ON `memberships` (`user_id`,`organization_id`);--> statement-breakpoint
CREATE TABLE `organizations` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `support_sessions` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`support_user_id` text NOT NULL,
	`expires_at` text NOT NULL,
	`revoked_at` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
DROP INDEX `idx_activities_company_id`;--> statement-breakpoint
DROP INDEX `idx_activities_due_at`;--> statement-breakpoint
ALTER TABLE `activities` ADD `organization_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `activities` ADD `contact_id` integer;--> statement-breakpoint
CREATE INDEX `idx_activities_org_company` ON `activities` (`organization_id`,`company_id`);--> statement-breakpoint
CREATE INDEX `idx_activities_org_due` ON `activities` (`organization_id`,`due_at`);--> statement-breakpoint
DROP INDEX `idx_companies_next_action_date`;--> statement-breakpoint
DROP INDEX `idx_companies_stage`;--> statement-breakpoint
ALTER TABLE `companies` ADD `organization_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
CREATE INDEX `idx_companies_org_next_action` ON `companies` (`organization_id`,`next_action_date`);--> statement-breakpoint
CREATE INDEX `idx_companies_org_stage` ON `companies` (`organization_id`,`stage`);--> statement-breakpoint
ALTER TABLE `audit_logs` ADD `organization_id` integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE `team_members` ADD `organization_id` integer DEFAULT 1 NOT NULL;
--> statement-breakpoint
ALTER TABLE `memberships` ADD `accepted_terms_at` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `memberships` ADD `completed_onboarding_at` text DEFAULT '' NOT NULL;
--> statement-breakpoint
CREATE TABLE `support_requests` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`organization_id` integer NOT NULL,
	`requested_by` text NOT NULL,
	`status` text DEFAULT 'Venter' NOT NULL,
	`created_at` text NOT NULL,
	`resolved_at` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_support_requests_org_status` ON `support_requests` (`organization_id`,`status`);--> statement-breakpoint
ALTER TABLE `companies` ADD `next_contact_id` integer;--> statement-breakpoint
ALTER TABLE `organizations` ADD `status` text DEFAULT 'Aktiv' NOT NULL;
--> statement-breakpoint
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
