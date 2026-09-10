CREATE TABLE `prospects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`org_number` text NOT NULL,
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
CREATE UNIQUE INDEX `idx_prospects_org_number` ON `prospects` (`org_number`);--> statement-breakpoint
CREATE INDEX `idx_prospects_status_created` ON `prospects` (`status`,`created_at`);