-- Languages get three slots instead of a role per block; the other kinds keep
-- being named blocks. Nothing is live yet, so the old tables are just replaced.
DROP TABLE IF EXISTS `blocks`;
DROP TABLE IF EXISTS `anchors`;
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`dose` text DEFAULT '' NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `assignments` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`language` text NOT NULL,
	`slot` text NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`dose` text DEFAULT '' NOT NULL,
	`target` text DEFAULT '' NOT NULL
);
