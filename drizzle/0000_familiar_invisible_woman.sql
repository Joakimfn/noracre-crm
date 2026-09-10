CREATE TABLE `companies` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`org_number` text DEFAULT '' NOT NULL,
	`contact_name` text DEFAULT '' NOT NULL,
	`phone` text DEFAULT '' NOT NULL,
	`email` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT 'Ny kunde' NOT NULL,
	`next_action` text DEFAULT '' NOT NULL,
	`next_action_date` text DEFAULT '' NOT NULL,
	`note` text DEFAULT '' NOT NULL,
	`industry` text DEFAULT '' NOT NULL,
	`city` text DEFAULT '' NOT NULL,
	`employees` integer,
	`revenue` integer,
	`source` text DEFAULT 'Manuelt' NOT NULL,
	`created_at` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT '' NOT NULL
);
