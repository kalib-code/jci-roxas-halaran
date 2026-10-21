CREATE TABLE `applications` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`birthdate` text NOT NULL,
	`barangay` text,
	`why_join` text,
	`referred_by` text,
	`consent` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`reviewed_by` text,
	`reviewed_at` text,
	`note` text,
	`member_id` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `applications_pending_email` ON `applications` (`email`) WHERE status = 'pending';--> statement-breakpoint
CREATE TABLE `campaigns` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`project_id` integer,
	`goal_centavos` integer NOT NULL,
	`qr_image_url` text,
	`qr_image_alt` text,
	`payment_instructions` text,
	`open` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `campaigns_slug_unique` ON `campaigns` (`slug`);--> statement-breakpoint
CREATE TABLE `events` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`description_json` text,
	`start_at` text NOT NULL,
	`end_at` text,
	`venue` text,
	`capacity` integer,
	`rsvp_open` integer DEFAULT true NOT NULL,
	`project_id` integer,
	`cover_url` text,
	`cover_alt` text,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `events_slug_unique` ON `events` (`slug`);--> statement-breakpoint
CREATE TABLE `events_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`type` text NOT NULL,
	`criterion` text NOT NULL,
	`actor` text DEFAULT 'public' NOT NULL,
	`ref_table` text,
	`ref_id` integer,
	`meta` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer,
	`campaign_id` integer,
	`amount_centavos` integer NOT NULL,
	`description` text NOT NULL,
	`spent_on` text NOT NULL,
	`receipt_url` text,
	`recorded_by` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE TABLE `payments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`campaign_id` integer,
	`type` text DEFAULT 'donation' NOT NULL,
	`payer_name` text NOT NULL,
	`payer_email` text NOT NULL,
	`member_id` integer,
	`amount_centavos` integer NOT NULL,
	`method` text NOT NULL,
	`reference_no` text NOT NULL,
	`proof_url` text,
	`consent` integer NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`confirmed_by` text,
	`confirmed_at` text,
	`note` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`campaign_id`) REFERENCES `campaigns`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payments_method_reference` ON `payments` (`method`,`reference_no`);--> statement-breakpoint
CREATE TABLE `rsvps` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`event_id` integer NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`consent` integer NOT NULL,
	`status` text DEFAULT 'going' NOT NULL,
	`attended` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rsvps_event_email` ON `rsvps` (`event_id`,`email`);--> statement-breakpoint
CREATE TABLE `volunteer_signups` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer,
	`event_id` integer,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`phone` text,
	`skills` text,
	`consent` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`event_id`) REFERENCES `events`(`id`) ON UPDATE no action ON DELETE set null
);
