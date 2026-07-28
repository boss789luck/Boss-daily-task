/**
 * Central Task Service
 * ─────────────────────────────────────────────────────────────────────────────
 * ALL task mutations MUST go through this service.
 * No router, import, webhook, or other module should write to the tasks table directly.
 *
 * Every mutation follows this sequence:
 *  1. validate input (done by tRPC zod schemas before calling service)
 *  2. update database
 *  3. recalculate project progress
 *  4. enqueue calendar sync (outbox — non-blocking)
 *  5. publish task.changed realtime event
 *  6. return latest task
 */

import { EventEmitter } from "node:events";
import { and, eq } from "drizzle-orm";
import { getDb, getTaskById, recalcProjectProgress, restoreTask } from "../db";
import { tasks, InsertTask } from "../../drizzle/schema";
// googleCalendarSync is created in the next step — forward declaration
let _enqueueCalendarSync: ((userId: number, taskId: number, action: string, task: any) => Promise<void>) | null = null;
export function registerCalendarSyncEnqueue(fn: typeof _enqueueCalendarSync) {
  _enqueueCalendarSync = fn;
}
async function enqueueCalendarSync(userId: number, taskId: number, action: string, task: any) {
  if (_enqueueCalendarSync) await _enqueueCalendarSync(userId, taskId, action, task);
}

// ─── Realtime Event Bus ───────────────────────────────────────────────────────
// In-process event emitter. TaskRealtimeBridge subscribes via tRPC SSE.
export const taskEventBus = new EventEmitter();
taskEventBus.setMaxListeners(200); // support many concurrent SSE connections

export type TaskEventType =
  | "task.created"
  | "task.updated"
  | "task.deleted"
  | "task.due_date_changed"
  | "task.status_changed"
  | "task.calendar_synced"
  | "task.calendar_sync_error";

export interface TaskChangedEvent {
  eventId: string;
  userId: number;
  taskId: number;
  type: TaskEventType;
  changedFields: string[];
  updatedAt: Date;
}

function publishTaskEvent(event: TaskChangedEvent) {
  taskEventBus.emit(`task.changed:${event.userId}`, event);
}

function makeEventId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ─── createTaskAndSync ────────────────────────────────────────────────────────
export async function createTaskAndSync(
  data: InsertTask & { userId: number }
): Promise<{ id: number }> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // 1. Compute priority score
  const { computePriorityScore, scoreToPriority } = await import("../db");
  const score = computePriorityScore(data);
  const priority = scoreToPriority(score);

  // 2. Insert task
  const result = await db.insert(tasks).values({ ...data, autoPriorityScore: score, priority }).returning({ insertId: tasks.id });
  const header = (result as any)?.[0];
  const insertId: number = header?.insertId;
  if (!insertId) throw new Error("Insert failed: no insertId");

  // 3. Recalculate project progress
  if (data.projectId) {
    await recalcProjectProgress(data.projectId, data.userId);
  }

  // 4. Enqueue calendar sync (non-blocking — outbox pattern)
  const task = await getTaskById(insertId, data.userId);
  if (task) {
    await enqueueCalendarSync(data.userId, insertId, "create", task);
  }

  // 5. Publish realtime event
  publishTaskEvent({
    eventId: makeEventId(),
    userId: data.userId,
    taskId: insertId,
    type: "task.created",
    changedFields: ["name", "dueDate", "status", "projectId"],
    updatedAt: new Date(),
  });

  return { id: insertId };
}

// ─── updateTaskAndSync ────────────────────────────────────────────────────────
export async function updateTaskAndSync(
  id: number,
  userId: number,
  data: Partial<InsertTask>
): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const before = await getTaskById(id, userId);
  if (!before) throw new Error("Task not found");

  // 1. Compute new priority
  const { computePriorityScore, scoreToPriority } = await import("../db");
  const merged = { ...before, ...data };
  const score = computePriorityScore(merged);
  const priority = data.manualPriorityOverride ?? scoreToPriority(score);

  // 2. Update DB
  await db.update(tasks)
    .set({ ...data, autoPriorityScore: score, priority })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  // 3. Recalculate project progress
  if (merged.projectId) {
    await recalcProjectProgress(merged.projectId, userId);
  }

  // 4. Determine changed fields
  const changedFields = Object.keys(data).filter(
    (k) => JSON.stringify((before as any)[k]) !== JSON.stringify((data as any)[k])
  );

  // 5. Enqueue calendar sync
  const updated = await getTaskById(id, userId);
  if (updated) {
    const action = (updated.status === "done" || updated.status === "cancelled") ? "toggle_done" : "update";
    await enqueueCalendarSync(userId, id, action, updated);
  }

  // 6. Publish realtime event
  const type: TaskEventType = changedFields.includes("dueDate")
    ? "task.due_date_changed"
    : changedFields.includes("status")
    ? "task.status_changed"
    : "task.updated";

  publishTaskEvent({
    eventId: makeEventId(),
    userId,
    taskId: id,
    type,
    changedFields,
    updatedAt: new Date(),
  });
}

// ─── deleteTaskAndSync ────────────────────────────────────────────────────────
export async function deleteTaskAndSync(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const task = await getTaskById(id, userId);
  if (!task) throw new Error("Task not found");

  // 1. Enqueue GCal delete BEFORE soft-deleting from DB (so we have googleEventId)
  await enqueueCalendarSync(userId, id, "delete", task);

  // 2. Soft-delete: set deletedAt (not a hard delete — Undo is possible)
  await db.update(tasks).set({ deletedAt: new Date() }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  // 3. Recalculate project progress
  if (task.projectId) {
    await recalcProjectProgress(task.projectId, userId);
  }

  // 4. Publish realtime event
  publishTaskEvent({
    eventId: makeEventId(),
    userId,
    taskId: id,
    type: "task.deleted",
    changedFields: [],
    updatedAt: new Date(),
  });
}

// ─── restoreTaskAndSync ───────────────────────────────────────────────────────
export async function restoreTaskAndSync(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  // Restore: clear deletedAt (task becomes active again)
  await restoreTask(id, userId);

  // Fetch the restored task
  const task = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).limit(1);
  const restored = task[0];
  if (!restored) throw new Error("Task not found after restore");

  // Re-enqueue GCal create/update sync so it reappears in Google Calendar
  if (restored.dueDate || restored.startDate) {
    await enqueueCalendarSync(userId, id, "create", restored);
  }

  // Recalculate project progress
  if (restored.projectId) {
    await recalcProjectProgress(restored.projectId, userId);
  }

  // Publish realtime event
  publishTaskEvent({
    eventId: makeEventId(),
    userId,
    taskId: id,
    type: "task.updated",
    changedFields: ["deletedAt"],
    updatedAt: new Date(),
  });
}

// ─── toggleTaskDoneAndSync ────────────────────────────────────────────────────
export async function toggleTaskDoneAndSync(id: number, userId: number): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("DB not available");

  const task = await getTaskById(id, userId);
  if (!task) throw new Error("Task not found");

  const newStatus = task.status === "done" ? "not_started" : "done";
  const completedAt = newStatus === "done" ? new Date() : null;

  await db.update(tasks)
    .set({ status: newStatus, completedAt })
    .where(and(eq(tasks.id, id), eq(tasks.userId, userId)));

  if (task.projectId) {
    await recalcProjectProgress(task.projectId, userId);
  }

  const updated = await getTaskById(id, userId);
  if (updated) {
    await enqueueCalendarSync(userId, id, "toggle_done", updated);
  }

  publishTaskEvent({
    eventId: makeEventId(),
    userId,
    taskId: id,
    type: "task.status_changed",
    changedFields: ["status", "completedAt"],
    updatedAt: new Date(),
  });
}

// ─── applyGoogleCalendarChange ────────────────────────────────────────────────
// Called by inbound Google Calendar webhook to update BOSS OS task dates.
// Includes loop-prevention: skip if change is an echo of our own outbound sync.
export async function applyGoogleCalendarChange(
  userId: number,
  googleEventId: string,
  newDueDate: Date | null,
  googleEventUpdatedAt: Date
): Promise<{ applied: boolean; reason: string }> {
  const db = await getDb();
  if (!db) return { applied: false, reason: "DB not available" };

  // Find task by googleEventId
  const rows = await db.select().from(tasks)
    .where(and(eq(tasks.userId, userId), eq(tasks.googleEventId, googleEventId)))
    .limit(1);
  const task = rows[0];
  if (!task) return { applied: false, reason: "Task not found for this event" };

  // Loop prevention: if our lastSyncedAt is within 30s of googleEventUpdatedAt,
  // this is likely an echo of our own push — skip.
  if (task.lastSyncedAt) {
    const diffMs = Math.abs(googleEventUpdatedAt.getTime() - task.lastSyncedAt.getTime());
    if (diffMs < 30_000) {
      return { applied: false, reason: "Echo prevention: change originated from BOSS OS" };
    }
  }

  // If dueDate is the same, skip
  const currentDue = task.dueDate?.toISOString().split("T")[0];
  const newDue = newDueDate?.toISOString().split("T")[0];
  if (currentDue === newDue) {
    return { applied: false, reason: "Date unchanged" };
  }

  // Apply the change — do NOT re-enqueue GCal sync (loop prevention)
  await db.update(tasks)
    .set({ dueDate: newDueDate, lastSyncedAt: new Date(), calendarSyncStatus: "synced" })
    .where(and(eq(tasks.id, task.id), eq(tasks.userId, userId)));

  if (task.projectId) {
    await recalcProjectProgress(task.projectId, userId);
  }

  // Publish realtime event so all BOSS OS clients update
  publishTaskEvent({
    eventId: makeEventId(),
    userId,
    taskId: task.id,
    type: "task.due_date_changed",
    changedFields: ["dueDate"],
    updatedAt: new Date(),
  });

  return { applied: true, reason: `Updated dueDate from ${currentDue} to ${newDue}` };
}
