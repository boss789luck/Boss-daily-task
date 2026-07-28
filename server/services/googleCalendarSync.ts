/**
 * Google Calendar Sync Service
 * ─────────────────────────────────────────────────────────────────────────────
 * Implements the Outbox pattern for reliable GCal sync:
 *  1. Task mutations enqueue a job in task_sync_outbox
 *  2. processOutbox() runs every 5s and processes pending jobs
 *  3. Failed jobs are retried with exponential backoff (max 3 attempts)
 *
 * CASE A: Create new GCal event (no googleEventId)
 * CASE B: Update existing GCal event (has googleEventId)
 * CASE C: Delete GCal event (action=delete)
 * CASE D: Done/cancelled → delete GCal event
 * CASE E: API error → mark as error, retry later
 */

import { and, eq, lte, or } from "drizzle-orm";
import { getDb } from "../db";
import { taskSyncOutbox, tasks } from "../../drizzle/schema";
import { autoSyncTask, autoDeleteTask } from "../googleCalendar";
import { registerCalendarSyncEnqueue } from "./taskService";

// ─── Enqueue a sync job ───────────────────────────────────────────────────────
export async function enqueueCalendarSync(
  userId: number,
  taskId: number,
  action: string,
  taskSnapshot: any
): Promise<void> {
  const db = await getDb();
  if (!db) return;

  // Deduplicate: if there's already a pending/processing job for this task,
  // update it instead of creating a duplicate
  const existing = await db.select().from(taskSyncOutbox)
    .where(and(
      eq(taskSyncOutbox.taskId, taskId),
      eq(taskSyncOutbox.userId, userId),
      or(eq(taskSyncOutbox.status, "pending"), eq(taskSyncOutbox.status, "processing"))
    ))
    .limit(1);

  if (existing.length > 0) {
    // Update the existing job with the latest action and snapshot
    await db.update(taskSyncOutbox)
      .set({
        action: action as any,
        payload: JSON.stringify(taskSnapshot),
        status: "pending",
        nextRetryAt: new Date(),
      })
      .where(eq(taskSyncOutbox.id, existing[0].id));
  } else {
    await db.insert(taskSyncOutbox).values({
      userId,
      taskId,
      action: action as any,
      payload: JSON.stringify(taskSnapshot),
      status: "pending",
      attempts: 0,
      nextRetryAt: new Date(),
    });
  }

  // Auto-sync immediately instead of waiting for setInterval
  await processOutbox();
}

// ─── Process pending outbox jobs ──────────────────────────────────────────────
let _processing = false;

export async function processOutbox(): Promise<void> {
  if (_processing) return;
  _processing = true;

  try {
    const db = await getDb();
    if (!db) return;

    const now = new Date();
    const pending = await db.select().from(taskSyncOutbox)
      .where(and(
        eq(taskSyncOutbox.status, "pending"),
        lte(taskSyncOutbox.nextRetryAt, now)
      ))
      .limit(20);

    for (const job of pending) {
      // Mark as processing
      await db.update(taskSyncOutbox)
        .set({ status: "processing" })
        .where(eq(taskSyncOutbox.id, job.id));

      try {
        const task = job.payload ? JSON.parse(job.payload) : null;

        if (job.action === "delete") {
          // CASE C: Delete GCal event
          if (task?.googleEventId) {
            await autoDeleteTask(job.userId, task.googleEventId);
          }
        } else if (task?.status === "done" || task?.status === "cancelled") {
          // CASE D: Done/cancelled → delete GCal event
          if (task?.googleEventId) {
            await autoDeleteTask(job.userId, task.googleEventId);
            // Clear googleEventId in DB
            await db.update(tasks)
              .set({ googleEventId: null, calendarSyncStatus: "unsynced", lastSyncedAt: new Date() })
              .where(and(eq(tasks.id, job.taskId), eq(tasks.userId, job.userId)));
          }
        } else {
          // CASE A/B: Create or update GCal event
          // Always fetch fresh task from DB to get latest googleEventId
          const freshRows = await db.select().from(tasks)
            .where(and(eq(tasks.id, job.taskId), eq(tasks.userId, job.userId)))
            .limit(1);
          const freshTask = freshRows[0];

          if (freshTask && (freshTask.dueDate || freshTask.startDate)) {
            await autoSyncTask(job.userId, freshTask);
          }
        }

        // Mark as done
        await db.update(taskSyncOutbox)
          .set({ status: "done", processedAt: new Date() })
          .where(eq(taskSyncOutbox.id, job.id));

      } catch (e: any) {
        const attempts = job.attempts + 1;
        const maxAttempts = 3;

        if (attempts >= maxAttempts) {
          // CASE E: Max retries reached
          await db.update(taskSyncOutbox)
            .set({
              status: "error",
              attempts,
              lastError: String(e),
              processedAt: new Date(),
            })
            .where(eq(taskSyncOutbox.id, job.id));
          console.error(`[GCalSync] Job ${job.id} failed after ${maxAttempts} attempts:`, e);
        } else {
          // Retry with exponential backoff: 30s, 2min, 10min
          const backoffMs = [30_000, 120_000, 600_000][attempts - 1] ?? 600_000;
          const nextRetryAt = new Date(Date.now() + backoffMs);
          await db.update(taskSyncOutbox)
            .set({
              status: "pending",
              attempts,
              lastError: String(e),
              nextRetryAt,
            })
            .where(eq(taskSyncOutbox.id, job.id));
          console.warn(`[GCalSync] Job ${job.id} attempt ${attempts} failed, retry at ${nextRetryAt.toISOString()}:`, e);
        }
      }
    }
  } finally {
    _processing = false;
  }
}

// ─── Start background outbox processor ───────────────────────────────────────
let _outboxTimer: ReturnType<typeof setInterval> | null = null;

export function startOutboxProcessor(): void {
  if (_outboxTimer) return;
  _outboxTimer = setInterval(() => {
    processOutbox().catch((e) => console.error("[GCalSync] processOutbox error:", e));
  }, 5_000); // every 5 seconds
  console.log("[GCalSync] Outbox processor started (5s interval)");
}

export function stopOutboxProcessor(): void {
  if (_outboxTimer) {
    clearInterval(_outboxTimer);
    _outboxTimer = null;
  }
}

// ─── Register with TaskService ────────────────────────────────────────────────
// This wires the forward declaration in taskService.ts
registerCalendarSyncEnqueue(enqueueCalendarSync);
