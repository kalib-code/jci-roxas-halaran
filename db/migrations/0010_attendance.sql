CREATE TABLE `attendance` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`position` text NOT NULL,
	`affiliation` text NOT NULL,
	`local_organization` text NOT NULL,
	`email` text,
	`member_id` integer,
	`rsvp_id` integer,
	`source` text NOT NULL,
	`checked_in_at` text NOT NULL,
	`added_by` text,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`rsvp_id`) REFERENCES `rsvps`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `attendance_event` ON `attendance` (`event_id`,`checked_in_at`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_event_email` ON `attendance` (`event_id`,`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_rsvp` ON `attendance` (`rsvp_id`);--> statement-breakpoint
ALTER TABLE `events` ADD `checkin_open` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `events` ADD `checkin_code` text;--> statement-breakpoint
ALTER TABLE `events` ADD `chairperson` text;--> statement-breakpoint
CREATE UNIQUE INDEX `events_checkin_code_unique` ON `events` (`checkin_code`);