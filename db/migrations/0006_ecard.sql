ALTER TABLE `members` ADD `phone` text;--> statement-breakpoint
ALTER TABLE `members` ADD `website_url` text;--> statement-breakpoint
ALTER TABLE `members` ADD `facebook_url` text;--> statement-breakpoint
ALTER TABLE `members` ADD `linkedin_url` text;--> statement-breakpoint
ALTER TABLE `members` ADD `instagram_url` text;--> statement-breakpoint
ALTER TABLE `members` ADD `card_published` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `card_show_phone` integer DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `members` ADD `card_show_email` integer DEFAULT true NOT NULL;