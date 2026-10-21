DROP INDEX `payments_method_reference`;--> statement-breakpoint
CREATE UNIQUE INDEX `payments_method_reference` ON `payments` (`method`,`reference_no`) WHERE status <> 'rejected';