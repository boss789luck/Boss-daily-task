CREATE TABLE `time_tracker_categories` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'clock' NOT NULL,
	`color` text DEFAULT '#6366f1' NOT NULL,
	`goalMinutesPerDay` integer DEFAULT 60 NOT NULL,
	`sortOrder` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `time_tracker_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`categoryId` integer NOT NULL,
	`logDate` text NOT NULL,
	`durationSeconds` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
