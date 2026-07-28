CREATE TABLE `areas` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`color` text DEFAULT '#6366f1',
	`icon` text DEFAULT 'folder',
	`sortOrder` integer DEFAULT 0,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `book_preferences` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`businessWeight` integer DEFAULT 100 NOT NULL,
	`financeWeight` integer DEFAULT 100 NOT NULL,
	`marketingWeight` integer DEFAULT 80 NOT NULL,
	`psychologyWeight` integer DEFAULT 70 NOT NULL,
	`philosophyWeight` integer DEFAULT 50 NOT NULL,
	`religionWeight` integer DEFAULT 50 NOT NULL,
	`managementWeight` integer DEFAULT 70 NOT NULL,
	`weeklyScheduleTaskUid` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `book_preferences_userId_unique` ON `book_preferences` (`userId`);--> statement-breakpoint
CREATE TABLE `book_records` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`habitId` integer NOT NULL,
	`title` text NOT NULL,
	`totalPages` integer NOT NULL,
	`pagesRead` integer DEFAULT 0 NOT NULL,
	`isCompleted` integer DEFAULT false NOT NULL,
	`startedAt` text,
	`completedAt` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `book_summaries` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`title` text NOT NULL,
	`author` text NOT NULL,
	`genre` text NOT NULL,
	`coverEmoji` text DEFAULT '📚' NOT NULL,
	`coverColor` text DEFAULT '#6366f1' NOT NULL,
	`summary` text NOT NULL,
	`keyLessons` text NOT NULL,
	`weekLabel` text NOT NULL,
	`isRead` integer DEFAULT false NOT NULL,
	`readAt` integer,
	`scheduleCronTaskUid` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `bucket_items` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`text` text NOT NULL,
	`category` text DEFAULT 'general',
	`isDone` integer DEFAULT false NOT NULL,
	`sortOrder` integer DEFAULT 0,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `calendar_settings` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`tokenExpiry` integer,
	`tasksCalendarId` text DEFAULT 'primary',
	`projectsCalendarId` text DEFAULT 'primary',
	`syncEnabled` integer DEFAULT false NOT NULL,
	`syncTasks` integer DEFAULT true NOT NULL,
	`syncProjects` integer DEFAULT true NOT NULL,
	`lastSyncedAt` integer,
	`watchChannelId` text,
	`watchResourceId` text,
	`watchExpiry` integer,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `calendar_settings_userId_unique` ON `calendar_settings` (`userId`);--> statement-breakpoint
CREATE TABLE `habit_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`habitId` integer NOT NULL,
	`logDate` text NOT NULL,
	`completed` integer DEFAULT false NOT NULL,
	`activityType` text,
	`durationMinutes` integer,
	`topic` text,
	`notes` text,
	`loggedTime` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `habits` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`name` text NOT NULL,
	`icon` text DEFAULT 'target',
	`color` text DEFAULT '#6366f1',
	`type` text DEFAULT 'frequency' NOT NULL,
	`weeklyTarget` integer DEFAULT 3,
	`monthlyTarget` integer DEFAULT 4,
	`timeLimit` text,
	`isBeforeLimit` integer DEFAULT true,
	`scoreWeight` real DEFAULT 20,
	`sortOrder` integer DEFAULT 0,
	`isActive` integer DEFAULT true NOT NULL,
	`isArchived` integer DEFAULT false NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `import_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`filename` text,
	`importType` text,
	`status` text DEFAULT 'pending',
	`totalRows` integer DEFAULT 0,
	`importedRows` integer DEFAULT 0,
	`errorMessage` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `notes` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`areaId` integer,
	`projectId` integer,
	`taskId` integer,
	`title` text NOT NULL,
	`content` text,
	`tags` text,
	`attachmentUrl` text,
	`externalUrl` text,
	`isArchived` integer DEFAULT false,
	`noteDate` integer,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `projects` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`areaId` integer,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`priority` text DEFAULT 'p2',
	`health` text DEFAULT 'on_track',
	`progress` real DEFAULT 0,
	`startDate` integer,
	`deadline` integer,
	`defaultCalendarId` text,
	`riskLevel` text DEFAULT 'low',
	`sortOrder` integer DEFAULT 0,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `reading_logs` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`bookId` integer NOT NULL,
	`logDate` text NOT NULL,
	`pagesReadToday` integer NOT NULL,
	`notes` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_change_audit_log` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`taskId` integer NOT NULL,
	`source` text NOT NULL,
	`action` text NOT NULL,
	`changedFields` text,
	`before` text,
	`after` text,
	`syncRevisionAtChange` integer DEFAULT 0 NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `task_sync_outbox` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`taskId` integer NOT NULL,
	`action` text NOT NULL,
	`payload` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`nextRetryAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`processedAt` integer,
	`lastError` text
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`areaId` integer,
	`projectId` integer,
	`parentTaskId` integer,
	`name` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'not_started' NOT NULL,
	`priority` text DEFAULT 'p2',
	`urgency` integer DEFAULT 3,
	`impact` integer DEFAULT 3,
	`effort` integer DEFAULT 3,
	`strategicAlignment` integer DEFAULT 3,
	`autoPriorityScore` real DEFAULT 0,
	`manualPriorityOverride` text,
	`dueDate` integer,
	`startDate` integer,
	`startTime` text,
	`endTime` text,
	`estimatedDuration` integer,
	`actualDuration` integer,
	`assignToday` integer DEFAULT false,
	`assignee` text,
	`progressPct` integer DEFAULT 0,
	`googleEventId` text,
	`googleCalendarId` text,
	`calendarSyncStatus` text DEFAULT 'unsynced',
	`lastSyncedAt` integer,
	`googleUpdatedAt` integer,
	`syncRevision` integer DEFAULT 0 NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`recurrenceRule` text,
	`eisenhowerQuadrant` text,
	`tags` text,
	`completedAt` integer,
	`isArchived` integer DEFAULT false,
	`sortOrder` integer DEFAULT 0,
	`deletedAt` integer,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`openId` text NOT NULL,
	`name` text,
	`email` text,
	`loginMethod` text,
	`role` text DEFAULT 'user' NOT NULL,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`lastSignedIn` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_openId_unique` ON `users` (`openId`);--> statement-breakpoint
CREATE TABLE `yearly_goals` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`userId` integer NOT NULL,
	`year` integer NOT NULL,
	`goals` text NOT NULL,
	`bgImageUrl` text,
	`bgPrompt` text,
	`createdAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL,
	`updatedAt` integer DEFAULT (strftime('%s', 'now')) NOT NULL
);
