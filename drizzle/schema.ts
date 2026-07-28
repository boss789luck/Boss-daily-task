import {
  integer,
  real,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";

// ─── Users ───────────────────────────────────────────────────────────────────
export const users = sqliteTable("users", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  openId: text("openId").notNull().unique(),
  name: text("name"),
  email: text("email"),
  loginMethod: text("loginMethod"),
  role: text("role", { enum: ["user", "admin"] }).default("user").notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  lastSignedIn: integer("lastSignedIn", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

// ─── Areas ───────────────────────────────────────────────────────────────────
export const areas = sqliteTable("areas", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  color: text("color").default("#6366f1"),
  icon: text("icon").default("folder"),
  sortOrder: integer("sortOrder").default(0),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type Area = typeof areas.$inferSelect;
export type InsertArea = typeof areas.$inferInsert;

// ─── Projects ─────────────────────────────────────────────────────────────────
export const projects = sqliteTable("projects", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  areaId: integer("areaId"),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: [
    "not_started",
    "planning",
    "in_progress",
    "waiting",
    "blocked",
    "on_hold",
    "completed",
    "archived",
  ] }).default("not_started").notNull(),
  priority: text("priority", { enum: ["p0", "p1", "p2", "p3"] }).default("p2"),
  health: text("health", { enum: ["on_track", "at_risk", "delayed", "critical"] }).default("on_track"),
  progress: real("progress").default(0),
  startDate: integer("startDate", { mode: 'timestamp' }),
  deadline: integer("deadline", { mode: 'timestamp' }),
  defaultCalendarId: text("defaultCalendarId"),
  riskLevel: text("riskLevel", { enum: ["low", "medium", "high", "critical"] }).default("low"),
  sortOrder: integer("sortOrder").default(0),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type Project = typeof projects.$inferSelect;
export type InsertProject = typeof projects.$inferInsert;

// ─── Tasks ────────────────────────────────────────────────────────────────────
export const tasks = sqliteTable("tasks", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  areaId: integer("areaId"),
  projectId: integer("projectId"),
  parentTaskId: integer("parentTaskId"),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status", { enum: [
    "inbox",
    "not_started",
    "next_action",
    "in_progress",
    "waiting",
    "blocked",
    "review",
    "done",
    "cancelled",
  ] }).default("not_started").notNull(),
  priority: text("priority", { enum: ["p0", "p1", "p2", "p3"] }).default("p2"),
  // Priority Engine fields
  urgency: integer("urgency").default(3),       // 1-5
  impact: integer("impact").default(3),         // 1-5
  effort: integer("effort").default(3),         // 1-5
  strategicAlignment: integer("strategicAlignment").default(3), // 1-5
  autoPriorityScore: real("autoPriorityScore").default(0),
  manualPriorityOverride: text("manualPriorityOverride", { enum: ["p0", "p1", "p2", "p3"] }),
  // Scheduling
  dueDate: integer("dueDate", { mode: 'timestamp' }),
  startDate: integer("startDate", { mode: 'timestamp' }),
  startTime: text("startTime"),  // HH:MM
  endTime: text("endTime"),      // HH:MM
  estimatedDuration: integer("estimatedDuration"),     // minutes
  actualDuration: integer("actualDuration"),           // minutes
  assignToday: integer("assignToday", { mode: 'boolean' }).default(false),
  assignee: text("assignee"),
  // Progress
  progressPct: integer("progressPct").default(0),
  // Calendar sync
  googleEventId: text("googleEventId"),
  googleCalendarId: text("googleCalendarId"),
  calendarSyncStatus: text("calendarSyncStatus", { enum: ["unsynced", "synced", "error"] }).default("unsynced"),
  lastSyncedAt: integer("lastSyncedAt", { mode: 'timestamp' }),
  googleUpdatedAt: integer("googleUpdatedAt", { mode: 'timestamp' }),
  syncRevision: integer("syncRevision").default(0).notNull(),
  revision: integer("revision").default(0).notNull(),
  // Recurrence
  recurrenceRule: text("recurrenceRule"),
  // Eisenhower Matrix
  eisenhowerQuadrant: text("eisenhowerQuadrant", { enum: ["do_first", "schedule", "delegate", "eliminate"] }),
  // Tags
  tags: text("tags"),  // JSON array of strings
  // Completion
  completedAt: integer("completedAt", { mode: 'timestamp' }),
  isArchived: integer("isArchived", { mode: 'boolean' }).default(false),
  sortOrder: integer("sortOrder").default(0),
  // Soft-delete: set when task is deleted, null = active. Permanently purged after 30 days.
  deletedAt: integer("deletedAt", { mode: 'timestamp' }),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type Task = typeof tasks.$inferSelect;
export type InsertTask = typeof tasks.$inferInsert;

// ─── Notes ────────────────────────────────────────────────────────────────────
export const notes = sqliteTable("notes", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  areaId: integer("areaId"),
  projectId: integer("projectId"),
  taskId: integer("taskId"),
  title: text("title").notNull(),
  content: text("content"),
  tags: text("tags"),         // JSON array of strings
  attachmentUrl: text("attachmentUrl"),
  externalUrl: text("externalUrl"),
  isArchived: integer("isArchived", { mode: 'boolean' }).default(false),
  noteDate: integer("noteDate", { mode: 'timestamp' }),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type Note = typeof notes.$inferSelect;
export type InsertNote = typeof notes.$inferInsert;

// ─── Import Log ───────────────────────────────────────────────────────────────
export const importLogs = sqliteTable("import_logs", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  filename: text("filename"),
  importType: text("importType", { enum: ["notion_project_csv", "notion_task_csv", "notion_zip"] }),
  status: text("status", { enum: ["pending", "processing", "completed", "failed"] }).default("pending"),
  totalRows: integer("totalRows").default(0),
  importedRows: integer("importedRows").default(0),
  errorMessage: text("errorMessage"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type ImportLog = typeof importLogs.$inferSelect;

// ─── Calendar Settings ────────────────────────────────────────────────────────
export const calendarSettings = sqliteTable("calendar_settings", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  // Google OAuth tokens
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  tokenExpiry: integer("tokenExpiry", { mode: 'timestamp' }),
  // Calendar IDs — users can set separate calendars for tasks vs projects
  tasksCalendarId: text("tasksCalendarId").default("primary"),
  projectsCalendarId: text("projectsCalendarId").default("primary"),
  // Sync preferences
  syncEnabled: integer("syncEnabled", { mode: 'boolean' }).default(false).notNull(),
  syncTasks: integer("syncTasks", { mode: 'boolean' }).default(true).notNull(),
  syncProjects: integer("syncProjects", { mode: 'boolean' }).default(true).notNull(),
  lastSyncedAt: integer("lastSyncedAt", { mode: 'timestamp' }),
  watchChannelId: text("watchChannelId"),
  watchResourceId: text("watchResourceId"),
  watchExpiry: integer("watchExpiry", { mode: 'number' }),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type CalendarSettings = typeof calendarSettings.$inferSelect;
export type InsertCalendarSettings = typeof calendarSettings.$inferInsert;

// ─── Task Sync Outbox ─────────────────────────────────────────────────────────
export const taskSyncOutbox = sqliteTable("task_sync_outbox", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  taskId: integer("taskId").notNull(),
  action: text("action", { enum: ["create", "update", "delete", "toggle_done"] }).notNull(),
  payload: text("payload"),
  status: text("status", { enum: ["pending", "processing", "done", "error"] }).default("pending").notNull(),
  attempts: integer("attempts").default(0).notNull(),
  nextRetryAt: integer("nextRetryAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  processedAt: integer("processedAt", { mode: 'timestamp' }),
  lastError: text("lastError"),
});

export type TaskSyncOutbox = typeof taskSyncOutbox.$inferSelect;
export type InsertTaskSyncOutbox = typeof taskSyncOutbox.$inferInsert;

// ─── Task Change Audit Log ────────────────────────────────────────────────────
export const taskChangeAuditLog = sqliteTable("task_change_audit_log", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  taskId: integer("taskId").notNull(),
  source: text("source", { enum: ["boss_os", "google_calendar"] }).notNull(),
  action: text("action", { enum: ["create", "update", "delete", "toggle_done"] }).notNull(),
  changedFields: text("changedFields"),
  before: text("before"),
  after: text("after"),
  syncRevisionAtChange: integer("syncRevisionAtChange").default(0).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type TaskChangeAuditLog = typeof taskChangeAuditLog.$inferSelect;
export type InsertTaskChangeAuditLog = typeof taskChangeAuditLog.$inferInsert;

// ─── Habits ───────────────────────────────────────────────────────────────────
export const habits = sqliteTable("habits", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  name: text("name").notNull(),
  icon: text("icon").default("target"),
  color: text("color").default("#6366f1"),
  type: text("type", { enum: ["frequency", "time_limit", "book", "monthly_frequency"] }).default("frequency").notNull(),
  weeklyTarget: integer("weeklyTarget").default(3),
  monthlyTarget: integer("monthlyTarget").default(4),
  timeLimit: text("timeLimit"),
  isBeforeLimit: integer("isBeforeLimit", { mode: 'boolean' }).default(true),
  scoreWeight: real("scoreWeight").default(20),
  sortOrder: integer("sortOrder").default(0),
  isActive: integer("isActive", { mode: 'boolean' }).default(true).notNull(),
  isArchived: integer("isArchived", { mode: 'boolean' }).default(false).notNull(),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type Habit = typeof habits.$inferSelect;
export type InsertHabit = typeof habits.$inferInsert;

// ─── Habit Logs ───────────────────────────────────────────────────────────────
export const habitLogs = sqliteTable("habit_logs", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  habitId: integer("habitId").notNull(),
  logDate: text("logDate").notNull(), // YYYY-MM-DD
  completed: integer("completed", { mode: 'boolean' }).default(false).notNull(),
  activityType: text("activityType"),
  durationMinutes: integer("durationMinutes"),
  topic: text("topic"),
  notes: text("notes"),
  loggedTime: text("loggedTime"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type HabitLog = typeof habitLogs.$inferSelect;
export type InsertHabitLog = typeof habitLogs.$inferInsert;

// ─── Book Records ─────────────────────────────────────────────────────────────
export const bookRecords = sqliteTable("book_records", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  habitId: integer("habitId").notNull(),
  title: text("title").notNull(),
  totalPages: integer("totalPages").notNull(),
  pagesRead: integer("pagesRead").default(0).notNull(),
  isCompleted: integer("isCompleted", { mode: 'boolean' }).default(false).notNull(),
  startedAt: text("startedAt"),
  completedAt: text("completedAt"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type BookRecord = typeof bookRecords.$inferSelect;
export type InsertBookRecord = typeof bookRecords.$inferInsert;

// ─── Reading Logs ─────────────────────────────────────────────────────────────
export const readingLogs = sqliteTable("reading_logs", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  bookId: integer("bookId").notNull(),
  logDate: text("logDate").notNull(), // YYYY-MM-DD
  pagesReadToday: integer("pagesReadToday").notNull(),
  notes: text("notes"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type ReadingLog = typeof readingLogs.$inferSelect;
export type InsertReadingLog = typeof readingLogs.$inferInsert;

// ─── Bucket List ─────────────────────────────────────────────────────────────
export const bucketItems = sqliteTable("bucket_items", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  text: text("text").notNull(),
  category: text("category").default("general"),
  isDone: integer("isDone", { mode: 'boolean' }).default(false).notNull(),
  sortOrder: integer("sortOrder").default(0),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type BucketItem = typeof bucketItems.$inferSelect;
export type InsertBucketItem = typeof bucketItems.$inferInsert;

// ─── Yearly Goals ─────────────────────────────────────────────────────────────
export const yearlyGoals = sqliteTable("yearly_goals", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  year: integer("year").notNull(),
  goals: text("goals").notNull(), // JSON array
  bgImageUrl: text("bgImageUrl"),
  bgPrompt: text("bgPrompt"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});

export type YearlyGoal = typeof yearlyGoals.$inferSelect;
export type InsertYearlyGoal = typeof yearlyGoals.$inferInsert;

// ─── Book Summaries (AI Weekly Book) ──────────────────────────────────────────
export const bookSummaries = sqliteTable("book_summaries", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull(),
  title: text("title").notNull(),
  author: text("author").notNull(),
  genre: text("genre").notNull(),
  coverEmoji: text("coverEmoji").default("📚").notNull(),
  coverColor: text("coverColor").default("#6366f1").notNull(),
  summary: text("summary").notNull(),
  keyLessons: text("keyLessons").notNull(),
  weekLabel: text("weekLabel").notNull(),
  isRead: integer("isRead", { mode: 'boolean' }).default(false).notNull(),
  readAt: integer("readAt", { mode: 'timestamp' }),
  scheduleCronTaskUid: text("scheduleCronTaskUid"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});
export type BookSummary = typeof bookSummaries.$inferSelect;
export type InsertBookSummary = typeof bookSummaries.$inferInsert;

// ─── Book Preferences ─────────────────────────────────────────────────────────
export const bookPreferences = sqliteTable("book_preferences", {
  id: integer("id", { mode: 'number' }).primaryKey({ autoIncrement: true }),
  userId: integer("userId").notNull().unique(),
  businessWeight: integer("businessWeight").default(100).notNull(),
  financeWeight: integer("financeWeight").default(100).notNull(),
  marketingWeight: integer("marketingWeight").default(80).notNull(),
  psychologyWeight: integer("psychologyWeight").default(70).notNull(),
  philosophyWeight: integer("philosophyWeight").default(50).notNull(),
  religionWeight: integer("religionWeight").default(50).notNull(),
  managementWeight: integer("managementWeight").default(70).notNull(),
  weeklyScheduleTaskUid: text("weeklyScheduleTaskUid"),
  createdAt: integer("createdAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
  updatedAt: integer("updatedAt", { mode: 'timestamp' }).default(sql`(strftime('%s', 'now'))`).notNull(),
});
export type BookPreference = typeof bookPreferences.$inferSelect;
export type InsertBookPreference = typeof bookPreferences.$inferInsert;
