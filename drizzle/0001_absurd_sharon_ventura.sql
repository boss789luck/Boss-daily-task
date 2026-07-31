CREATE TABLE `card_entity_links` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`cardId` integer NOT NULL,
	`entityId` integer NOT NULL,
	`linkedSince` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`note` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cards` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`cardName` text NOT NULL,
	`bankName` text,
	`cardNumberEncrypted` text NOT NULL,
	`cardNumberLast4` text NOT NULL,
	`expiryEncrypted` text NOT NULL,
	`cvvEncrypted` text NOT NULL,
	`cardholderNameEncrypted` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `entities` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`loginNote` text,
	`status` text DEFAULT 'active' NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
ALTER TABLE `users` ADD `masterPinHash` text;--> statement-breakpoint
ALTER TABLE `users` ADD `masterPinSalt` text;