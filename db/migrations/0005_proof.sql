CREATE TABLE `analytics_snapshots` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`month` text NOT NULL,
	`organic_clicks` integer,
	`impressions` integer,
	`visitors` integer,
	`note` text,
	`updated_by` text,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `analytics_snapshots_month_unique` ON `analytics_snapshots` (`month`);--> statement-breakpoint
CREATE TABLE `project_metrics` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`project_id` integer NOT NULL,
	`metric` text NOT NULL,
	`value` integer NOT NULL,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `project_metrics_project_metric` ON `project_metrics` (`project_id`,`metric`);