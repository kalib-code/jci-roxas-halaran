ALTER TABLE `attendance` ADD `checked_out_at` text;--> statement-breakpoint
ALTER TABLE `events` ADD `format` text DEFAULT 'in_person' NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `online_code` text;--> statement-breakpoint
ALTER TABLE `events` ADD `start_code` text;--> statement-breakpoint
ALTER TABLE `events` ADD `end_code` text;--> statement-breakpoint
ALTER TABLE `events` ADD `end_code_shown_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `events_online_code_unique` ON `events` (`online_code`);