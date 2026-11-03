CREATE TABLE `volunteer_drives` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`event_id` integer,
	`project_id` integer,
	`starts_at` text,
	`venue` text,
	`closes_on` text,
	`open` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `volunteer_drives_slug_unique` ON `volunteer_drives` (`slug`);--> statement-breakpoint
CREATE TABLE `volunteer_roles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`drive_id` integer NOT NULL,
	`label` text NOT NULL,
	`description` text,
	`slots` integer,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`drive_id`) REFERENCES `volunteer_drives`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `volunteer_roles_drive` ON `volunteer_roles` (`drive_id`,`sort`);--> statement-breakpoint
ALTER TABLE `volunteer_signups` ADD `drive_id` integer REFERENCES volunteer_drives(id) ON DELETE cascade;--> statement-breakpoint
ALTER TABLE `volunteer_signups` ADD `role_id` integer REFERENCES volunteer_roles(id) ON DELETE set null;--> statement-breakpoint
ALTER TABLE `volunteer_signups` ADD `status` text DEFAULT 'confirmed' NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX `volunteer_signups_drive_email` ON `volunteer_signups` (`drive_id`,`email`);