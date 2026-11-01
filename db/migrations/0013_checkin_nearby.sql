ALTER TABLE `attendance` ADD `distance_m` integer;--> statement-breakpoint
ALTER TABLE `events` ADD `lat` real;--> statement-breakpoint
ALTER TABLE `events` ADD `lng` real;--> statement-breakpoint
ALTER TABLE `events` ADD `checkin_nearby` integer DEFAULT false NOT NULL;