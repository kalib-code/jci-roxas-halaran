ALTER TABLE `members` ADD `links` text;--> statement-breakpoint
-- Copy the four fixed link columns into the list, in the order the card showed them.
UPDATE `members` SET `links` = json_array() WHERE coalesce(`facebook_url`, `linkedin_url`, `instagram_url`, `website_url`) IS NOT NULL;--> statement-breakpoint
UPDATE `members` SET `links` = json_insert(`links`, '$[#]', json_object('label', 'Facebook', 'url', `facebook_url`)) WHERE `facebook_url` IS NOT NULL;--> statement-breakpoint
UPDATE `members` SET `links` = json_insert(`links`, '$[#]', json_object('label', 'LinkedIn', 'url', `linkedin_url`)) WHERE `linkedin_url` IS NOT NULL;--> statement-breakpoint
UPDATE `members` SET `links` = json_insert(`links`, '$[#]', json_object('label', 'Instagram', 'url', `instagram_url`)) WHERE `instagram_url` IS NOT NULL;--> statement-breakpoint
UPDATE `members` SET `links` = json_insert(`links`, '$[#]', json_object('label', 'Website', 'url', `website_url`)) WHERE `website_url` IS NOT NULL;
