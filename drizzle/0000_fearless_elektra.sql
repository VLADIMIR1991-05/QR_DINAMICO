CREATE TABLE `qr_codes` (
	`id` text PRIMARY KEY NOT NULL,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`destination` text NOT NULL,
	`edit_token` text NOT NULL,
	`scans` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `qr_codes_slug_unique` ON `qr_codes` (`slug`);