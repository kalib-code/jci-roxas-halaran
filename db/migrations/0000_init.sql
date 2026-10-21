CREATE TABLE `awards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`awarded_by` text NOT NULL,
	`year` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `awards_title_year` ON `awards` (`title`,`year`);--> statement-breakpoint
CREATE TABLE `faqs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`question` text NOT NULL,
	`answer` text NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `faqs_question_unique` ON `faqs` (`question`);--> statement-breakpoint
CREATE TABLE `members` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`clerk_user_id` text,
	`slug` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`photo_url` text,
	`profession` text,
	`business` text,
	`skills` text,
	`bio` text,
	`quote` text,
	`joined_at` text,
	`status` text DEFAULT 'active' NOT NULL,
	`in_directory` integer DEFAULT false NOT NULL,
	`fee_paid_year` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `members_clerk_user_id_unique` ON `members` (`clerk_user_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `members_slug_unique` ON `members` (`slug`);--> statement-breakpoint
CREATE TABLE `officer_terms` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`member_id` integer NOT NULL,
	`role` text NOT NULL,
	`year` integer NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`member_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `officer_terms_member_year_role` ON `officer_terms` (`member_id`,`year`,`role`);--> statement-breakpoint
CREATE TABLE `project_photos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`url` text NOT NULL,
	`caption` text,
	`alt` text NOT NULL,
	`kind` text DEFAULT 'gallery' NOT NULL,
	`sort` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`summary` text,
	`body` text,
	`cover_url` text,
	`cover_alt` text,
	`start_date` text,
	`end_date` text,
	`barangay` text,
	`lat` real,
	`lng` real,
	`pillar` text DEFAULT 'community' NOT NULL,
	`status` text DEFAULT 'done' NOT NULL,
	`featured` integer DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `projects_slug_unique` ON `projects` (`slug`);--> statement-breakpoint
CREATE TABLE `sponsors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`name` text NOT NULL,
	`logo_url` text,
	`url` text,
	`tier` text,
	`year` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `sponsors_name_unique` ON `sponsors` (`name`);