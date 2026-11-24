CREATE TABLE `anchors` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`language` text NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`dose` text DEFAULT '' NOT NULL,
	`target` text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE `blocks` (
	`id` text PRIMARY KEY NOT NULL,
	`domain` text NOT NULL,
	`title` text NOT NULL,
	`detail` text DEFAULT '' NOT NULL,
	`language` text DEFAULT '' NOT NULL,
	`dose` text DEFAULT '' NOT NULL,
	`target` text DEFAULT '' NOT NULL,
	`from` text NOT NULL,
	`to` text NOT NULL,
	`notes` text DEFAULT '' NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `languages` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`level` text DEFAULT '' NOT NULL,
	`aim` text DEFAULT '' NOT NULL,
	`stage` text DEFAULT '' NOT NULL,
	`position` integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE `meta` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
