CREATE TABLE `passport_entries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`points` integer NOT NULL,
	`note` text,
	`ref_table` text,
	`ref_id` integer,
	`status` text DEFAULT 'requested' NOT NULL,
	`requested_by` text,
	`verified_by` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `passport_entries_ref` ON `passport_entries` (`ref_table`,`ref_id`);