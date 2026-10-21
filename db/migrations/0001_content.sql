CREATE TABLE `articles` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`slug` text NOT NULL,
	`title` text NOT NULL,
	`meta_description` text,
	`target_keyword` text,
	`category` text DEFAULT 'community' NOT NULL,
	`body_json` text,
	`body_html` text,
	`cover_url` text,
	`cover_alt` text,
	`author_id` integer,
	`project_id` integer,
	`status` text DEFAULT 'draft' NOT NULL,
	`published_at` text,
	`updated_at` text NOT NULL,
	`updated_by` text,
	FOREIGN KEY (`author_id`) REFERENCES `members`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `articles_slug_unique` ON `articles` (`slug`);--> statement-breakpoint
CREATE TABLE `resources` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`file_url` text NOT NULL,
	`kind` text DEFAULT 'template' NOT NULL,
	`visibility` text DEFAULT 'public' NOT NULL,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `seo_plan` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`keyword` text NOT NULL,
	`volume` integer,
	`kd` integer,
	`working_title` text,
	`status` text DEFAULT 'idea' NOT NULL,
	`article_id` integer,
	FOREIGN KEY (`article_id`) REFERENCES `articles`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE UNIQUE INDEX `seo_plan_month_keyword` ON `seo_plan` (`month`,`keyword`);--> statement-breakpoint
ALTER TABLE `projects` ADD `body_json` text;--> statement-breakpoint
ALTER TABLE `projects` ADD `updated_at` text;