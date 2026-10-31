ALTER TABLE `attendance` ADD `certificate_code` text;--> statement-breakpoint
ALTER TABLE `attendance` ADD `certificate_sent_at` text;--> statement-breakpoint
CREATE UNIQUE INDEX `attendance_certificate_code_unique` ON `attendance` (`certificate_code`);