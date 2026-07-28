/**
 * Google Calendar Integration
 * ─────────────────────────────────────────────────────────────────────────────
 * Flow:
 *  1. User clicks "Connect Google Calendar" → frontend calls /api/google/auth
 *  2. Server redirects to Google OAuth consent screen
 *  3. Google redirects back to /api/google/callback with code
 *  4. Server exchanges code for tokens, stores in calendarSettings table
 *  5. User configures Calendar IDs (tasks / projects) in Settings page
 *  6. Sync pushes BOSS OS tasks/projects as Google Calendar events
 *  7. Auto-sync: task/project CRUD mutations trigger sync automatically
 *
 * Key rules:
 *  - Only sync tasks/projects that are NOT done/cancelled
 *  - When a task is marked done/cancelled → delete its GCal event
 *  - Store the returned GCal event ID in tasks.googleEventId to avoid duplicates
 *  - On update: use existing googleEventId to PUT (update) instead of POST (create)
 */


import { getDb } from "./db";
import { calendarSettings, tasks, projects, notes, taskSyncOutbox, taskChangeAuditLog } from "../drizzle/schema";
import { eq, and, isNotNull, inArray, notInArray } from "drizzle-orm";
import { sdk } from "./_core/sdk";

// ─── Google OAuth Config ──────────────────────────────────────────────────────
import { ENV } from "./_core/env";
const GOOGLE_CLIENT_ID = ENV.googleClientId;
const GOOGLE_CLIENT_SECRET = ENV.googleClientSecret;
const GOOGLE_SCOPES = [
  "https://www.googleapis.com/auth/calendar",
  "https://www.googleapis.com/auth/calendar.events",
].join(" ");

function getRedirectUri(req: Request): string {
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}/api/google/callback`;
}

// ─── Token Refresh ────────────────────────────────────────────────────────────
export async function refreshGoogleToken(userId: number): Promise<string | null> {
  const db = await getDb();
  if (!db) return null;

  const rows = await db.select().from(calendarSettings).where(eq(calendarSettings.userId, userId)).limit(1);
  const settings = rows[0];
  if (!settings?.refreshToken) return null;

  // Check if token is still valid (5 min buffer)
  if (settings.accessToken && settings.tokenExpiry && settings.tokenExpiry.getTime() > Date.now() + 5 * 60 * 1000) {
    return settings.accessToken;
  }

  try {
    const resp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: settings.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const data = await resp.json() as any;
    if (!data.access_token) return null;

    const expiry = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
    await db.update(calendarSettings)
      .set({ accessToken: data.access_token, tokenExpiry: expiry, updatedAt: new Date() })
      .where(eq(calendarSettings.userId, userId));

    return data.access_token;
  } catch (e) {
    console.error("[Google Calendar] Token refresh failed:", e);
    return null;
  }
}

// ─── Google Calendar API helpers ──────────────────────────────────────────────
export async function gcalRequest(
  userId: number,
  method: string,
  path: string,
  body?: object
): Promise<any> {
  const token = await refreshGoogleToken(userId);
  if (!token) throw new Error("Not connected to Google Calendar");

  const resp = await fetch(`https://www.googleapis.com/calendar/v3${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Google Calendar API error ${resp.status}: ${err}`);
  }
  if (resp.status === 204) return null;
  return resp.json();
}

// ─── List user's calendars ────────────────────────────────────────────────────
export async function listUserCalendars(userId: number): Promise<Array<{ id: string; summary: string; primary?: boolean }>> {
  try {
    const data = await gcalRequest(userId, "GET", "/users/me/calendarList");
    return (data.items ?? []).map((c: any) => ({
      id: c.id,
      summary: c.summary,
      primary: c.primary ?? false,
    }));
  } catch {
    return [];
  }
}

// ─── Get user's calendar settings ────────────────────────────────────────────
export async function getUserCalendarSettings(userId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db.select().from(calendarSettings).where(eq(calendarSettings.userId, userId)).limit(1);
  return rows[0] ?? null;
}

// ─── Persist googleEventId back to task row ───────────────────────────────────
async function saveTaskEventId(taskId: number, userId: number, googleEventId: string, calendarId: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.update(tasks)
      .set({
        googleEventId,
        googleCalendarId: calendarId,
        calendarSyncStatus: "synced",
        lastSyncedAt: new Date(),
      })
      .where(eq(tasks.id, taskId));
  } catch (e) {
    console.error("[Google Calendar] saveTaskEventId failed:", e);
  }
}


// ─── Bangkok-aware date string helper ────────────────────────────────────────
/**
 * Convert a UTC Date to a YYYY-MM-DD string in Asia/Bangkok (UTC+7).
 * Prevents the off-by-one-day bug when UTC midnight is still the previous day
 * in Bangkok time.
 */
function toBangkokDateStr(d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
  // en-CA locale produces YYYY-MM-DD format
}
// ─── Build Google Calendar event body (Phase 6 rules) ────────────────────────
/**
 * Phase 6 Due Date / Time Rules:
 * 1. dueDate only, no startTime  → All-day event (start.date / end.date = next day)
 * 2. dueDate + startTime         → Timed event in Asia/Bangkok
 * 3. startTime but no endTime    → use estimatedDuration (default 60 min)
 * 4. All-day: end.date = dueDate + 1 day
 * 5. Timed: start.dateTime / end.dateTime with timeZone = Asia/Bangkok
 */
function buildGCalEventBody(
  task: {
    id: number;
    name: string;
    description?: string | null;
    dueDate?: Date | null;
    startDate?: Date | null;
    startTime?: string | null;   // "HH:MM" 24h format
    endTime?: string | null;     // "HH:MM" 24h format
    estimatedDuration?: number | null; // minutes
    status?: string | null;
    priority?: string | null;
    userId?: number;
    updatedAt?: Date | null;
  },
  userId: number
): object {
  const TZ = "Asia/Bangkok";
  const priorityLabel = task.priority ? ` [${task.priority.toUpperCase()}]` : "";
  const baseDate = task.dueDate ?? task.startDate!;

  // Extended properties for loop prevention and mapping
  const extProps = {
    private: {
      bossTaskId: String(task.id),
      bossUserId: String(userId),
      bossUpdatedAt: (task.updatedAt ?? new Date()).toISOString(),
      syncSource: "boss-os",
      bossType: "task",
    },
  };

  const summary = `[BOSS] ${task.name}${priorityLabel}`;
  const description = task.description ?? "";

  if (task.startTime) {
    // ── Timed event ──────────────────────────────────────────────────────────
    // IMPORTANT: Always use Bangkok date + Bangkok time string directly.
    // Using new Date(baseDate).setHours() would apply hours in UTC (server TZ),
    // which shifts the event to the wrong day/time in Bangkok.
    const bangkokDateStr = toBangkokDateStr(baseDate); // e.g. "2026-07-08"
    // IMPORTANT: Include +07:00 offset so GCal interprets the time as Bangkok, not UTC.
    // Without offset, GCal treats the datetime as UTC regardless of timeZone field.
    const BKK_OFFSET = "+07:00";
    const startDateTimeStr = `${bangkokDateStr}T${task.startTime}:00${BKK_OFFSET}`; // "2026-07-08T23:30:00+07:00"

    let endDateTimeStr: string;
    if (task.endTime) {
      // If endTime is earlier than startTime, it means it crosses midnight → use next day
      const [sh2, sm2] = task.startTime!.split(":").map(Number);
      const [eh2, em2] = task.endTime.split(":").map(Number);
      const startMinOfDay = sh2 * 60 + sm2;
      const endMinOfDay = eh2 * 60 + em2;
      if (endMinOfDay <= startMinOfDay) {
        // Crosses midnight: end date is next Bangkok day
        const nextDay = new Date(baseDate);
        nextDay.setDate(nextDay.getDate() + 1);
        endDateTimeStr = `${toBangkokDateStr(nextDay)}T${task.endTime}:00${BKK_OFFSET}`;
      } else {
        endDateTimeStr = `${bangkokDateStr}T${task.endTime}:00${BKK_OFFSET}`;
      }
    } else {
      // Calculate end time by adding duration in minutes
      const [sh, sm] = task.startTime!.split(":").map(Number);
      const durationMin = task.estimatedDuration ?? 60;
      const totalMin = sh * 60 + sm + durationMin;
      const overflowDays = Math.floor(totalMin / (24 * 60));
      const eh = Math.floor((totalMin % (24 * 60)) / 60);
      const em = totalMin % 60;
      if (overflowDays > 0) {
        // End time crosses midnight → use next Bangkok day
        const nextDay = new Date(baseDate);
        nextDay.setDate(nextDay.getDate() + overflowDays);
        endDateTimeStr = `${toBangkokDateStr(nextDay)}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00${BKK_OFFSET}`;
      } else {
        endDateTimeStr = `${bangkokDateStr}T${String(eh).padStart(2, "0")}:${String(em).padStart(2, "0")}:00${BKK_OFFSET}`;
      }
    }

    return {
      summary,
      description,
      start: { dateTime: startDateTimeStr, timeZone: TZ },
      end: { dateTime: endDateTimeStr, timeZone: TZ },
      extendedProperties: extProps,
    };
  } else {
    // ── All-day event ─────────────────────────────────────────────────────────
    const startDateStr = toBangkokDateStr(baseDate);
    // end.date must be the day AFTER for a 1-day all-day event
    const endDate = new Date(baseDate);
    endDate.setDate(endDate.getDate() + 1);
    const endDateStr = toBangkokDateStr(endDate);

    return {
      summary,
      description,
      start: { date: startDateStr },
      end: { date: endDateStr },
      extendedProperties: extProps,
    };
  }
}

// ─── Push a task as a Google Calendar event ───────────────────────────────────
export async function pushTaskToCalendar(
  userId: number,
  task: {
    id: number;
    name: string;
    description?: string | null;
    dueDate?: Date | null;
    startDate?: Date | null;
    startTime?: string | null;
    endTime?: string | null;
    estimatedDuration?: number | null;
    status?: string | null;
    priority?: string | null;
    googleEventId?: string | null;
    updatedAt?: Date | null;
  },
  calendarId: string
): Promise<string | null> {
  if (!task.dueDate && !task.startDate) return null;

  // CASE D/E: Never push done/cancelled tasks
  if (task.status === "done" || task.status === "cancelled") {
    if (task.googleEventId) {
      await deleteTaskFromCalendar(userId, task.googleEventId, calendarId);
      // Clear googleEventId in DB
      const db = await getDb();
      if (db) {
        await db.update(tasks)
          .set({ googleEventId: null, calendarSyncStatus: "unsynced", lastSyncedAt: new Date() })
          .where(eq(tasks.id, task.id));
      }
    }
    return null;
  }

  const event = buildGCalEventBody(task, userId);

  try {
    let eventId: string | null = null;

    if (task.googleEventId) {
      // CASE B: Update existing event — use PATCH to avoid overwriting fields we don't know
      try {
        await gcalRequest(userId, "PUT", `/calendars/${encodeURIComponent(calendarId)}/events/${task.googleEventId}`, event);
        eventId = task.googleEventId;
        console.log(`[GCal] Updated event ${eventId} for task ${task.id}`);
      } catch (e: any) {
        // CASE B fallback: event was deleted in GCal (404) → create new
        if (String(e).includes("404")) {
          console.log(`[GCal] Event ${task.googleEventId} not found, creating new for task ${task.id}`);
          const created = await gcalRequest(userId, "POST", `/calendars/${encodeURIComponent(calendarId)}/events`, event);
          eventId = created?.id ?? null;
        } else {
          throw e;
        }
      }
    } else {
      // CASE A: Create new event
      const created = await gcalRequest(userId, "POST", `/calendars/${encodeURIComponent(calendarId)}/events`, event);
      eventId = created?.id ?? null;
      console.log(`[GCal] Created event ${eventId} for task ${task.id}`);
    }

    if (eventId) {
      await saveTaskEventId(task.id, userId, eventId, calendarId);
    }

    return eventId;
  } catch (e) {
    // CASE E: API error — mark task as error but don't fail the task save
    console.error("[Google Calendar] pushTask failed:", e);
    const db = await getDb();
    if (db) {
      await db.update(tasks)
        .set({ calendarSyncStatus: "error", lastSyncedAt: new Date() })
        .where(eq(tasks.id, task.id));
    }
    return null;
  }
}

// ─── Delete a task event from Google Calendar ────────────────────────────────
export async function deleteTaskFromCalendar(
  userId: number,
  googleEventId: string,
  calendarId: string
): Promise<void> {
  if (!googleEventId) return;
  try {
    await gcalRequest(userId, "DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`);
  } catch (e) {
    // Ignore 404 (already deleted)
    if (!String(e).includes("404")) {
      console.error("[Google Calendar] deleteTask failed:", e);
    }
  }
}

// ─── Push a project as a Google Calendar event ───────────────────────────────
export async function pushProjectToCalendar(
  userId: number,
  project: {
    id: number;
    name: string;
    description?: string | null;
    deadline?: Date | null;
    startDate?: Date | null;
    status?: string | null;
    googleEventId?: string | null;  // ← correct field name
  },
  calendarId: string
): Promise<string | null> {
  if (!project.deadline && !project.startDate) return null;

  const start = project.startDate ?? project.deadline!;
  const end = project.deadline ?? project.startDate!;

  const statusEmoji = project.status === "completed" ? "✅ " : project.status === "in_progress" ? "🔄 " : "";

  const event = {
    summary: `[PROJECT] ${statusEmoji}${project.name}`,
    description: project.description ?? "",
    start: { date: toBangkokDateStr(start) },
    end: { date: toBangkokDateStr(end) },
    extendedProperties: {
      private: { bossProjectId: String(project.id), bossType: "project" },
    },
  };

  try {
    let eventId: string | null = null;
    if (project.googleEventId) {
      try {
        await gcalRequest(userId, "PUT", `/calendars/${encodeURIComponent(calendarId)}/events/${project.googleEventId}`, event);
        eventId = project.googleEventId;
      } catch (e: any) {
        if (String(e).includes("404")) {
          const created = await gcalRequest(userId, "POST", `/calendars/${encodeURIComponent(calendarId)}/events`, event);
          eventId = created?.id ?? null;
        } else {
          throw e;
        }
      }
    } else {
      const created = await gcalRequest(userId, "POST", `/calendars/${encodeURIComponent(calendarId)}/events`, event);
      eventId = created?.id ?? null;
    }
    return eventId;
  } catch (e) {
    console.error("[Google Calendar] pushProject failed:", e);
    return null;
  }
}

// ─── Delete a project event from Google Calendar ─────────────────────────────
export async function deleteProjectFromCalendar(
  userId: number,
  googleEventId: string,
  calendarId: string
): Promise<void> {
  if (!googleEventId) return;
  try {
    await gcalRequest(userId, "DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${googleEventId}`);
  } catch (e) {
    if (!String(e).includes("404")) {
      console.error("[Google Calendar] deleteProject failed:", e);
    }
  }
}

// ─── Auto-sync helpers (called from task/project mutations) ───────────────────

/**
 * Auto-sync a single task to Google Calendar after create/update.
 * Silently skips if user has no calendar connected or sync is disabled.
 * Skips done/cancelled tasks (deletes their event if they have one).
 */
export async function autoSyncTask(
  userId: number,
  task: {
    id: number;
    name: string;
    description?: string | null;
    dueDate?: Date | null;
    startDate?: Date | null;
    status?: string | null;
    priority?: string | null;
    googleEventId?: string | null;  // ← correct field name
  }
): Promise<string | null> {
  try {
    const settings = await getUserCalendarSettings(userId);
    if (!settings?.accessToken || !settings.syncEnabled || !settings.syncTasks) return null;
    if (!task.dueDate && !task.startDate) return null;

    const calendarId = settings.tasksCalendarId ?? "primary";
    return await pushTaskToCalendar(userId, task, calendarId);
  } catch (e) {
    console.error("[Google Calendar] autoSyncTask failed (non-fatal):", e);
    return null;
  }
}

/**
 * Auto-delete a task event from Google Calendar after task deletion.
 * Silently skips if user has no calendar connected or no googleEventId.
 */
export async function autoDeleteTask(
  userId: number,
  googleEventId: string | null | undefined  // ← correct field name
): Promise<void> {
  if (!googleEventId) return;
  try {
    const settings = await getUserCalendarSettings(userId);
    if (!settings?.accessToken || !settings.syncEnabled || !settings.syncTasks) return;
    const calendarId = settings.tasksCalendarId ?? "primary";
    await deleteTaskFromCalendar(userId, googleEventId, calendarId);
  } catch (e) {
    console.error("[Google Calendar] autoDeleteTask failed (non-fatal):", e);
  }
}

/**
 * Auto-sync a single project to Google Calendar after create/update.
 */
export async function autoSyncProject(
  userId: number,
  project: {
    id: number;
    name: string;
    description?: string | null;
    deadline?: Date | null;
    startDate?: Date | null;
    status?: string | null;
    googleEventId?: string | null;  // ← correct field name
  }
): Promise<string | null> {
  try {
    const settings = await getUserCalendarSettings(userId);
    if (!settings?.accessToken || !settings.syncEnabled || !settings.syncProjects) return null;
    if (!project.deadline && !project.startDate) return null;

    const calendarId = settings.projectsCalendarId ?? "primary";
    return await pushProjectToCalendar(userId, project, calendarId);
  } catch (e) {
    console.error("[Google Calendar] autoSyncProject failed (non-fatal):", e);
    return null;
  }
}

/**
 * Auto-delete a project event from Google Calendar after project deletion.
 */
export async function autoDeleteProject(
  userId: number,
  googleEventId: string | null | undefined  // ← correct field name
): Promise<void> {
  if (!googleEventId) return;
  try {
    const settings = await getUserCalendarSettings(userId);
    if (!settings?.accessToken || !settings.syncEnabled || !settings.syncProjects) return;
    const calendarId = settings.projectsCalendarId ?? "primary";
    await deleteProjectFromCalendar(userId, googleEventId, calendarId);
  } catch (e) {
    console.error("[Google Calendar] autoDeleteProject failed (non-fatal):", e);
  }
}

// ─── Pull from Google Calendar → update BOSS OS task dates ──────────────────
/**
 * Fetch all BOSS task events from Google Calendar and:
 * 1. Update task dueDate/startDate if the event was moved (date changed)
 * 2. Detect deleted events (status=cancelled) and clear the task's dueDate + googleEventId in BOSS OS
 * Returns { updated, deleted, skipped, errors }.
 */
export async function pullFromGoogleCalendar(userId: number): Promise<{
  updated: number;
  deleted: number;
  skipped: number;
  errors: string[];
}> {
  const db = await getDb();
  if (!db) return { updated: 0, deleted: 0, skipped: 0, errors: ["DB not available"] };

  const settingsRows = await db.select().from(calendarSettings).where(eq(calendarSettings.userId, userId)).limit(1);
  const settings = settingsRows[0];
  if (!settings?.accessToken || !settings.syncEnabled || !settings.syncTasks) {
    return { updated: 0, deleted: 0, skipped: 0, errors: [] };
  }

  const calendarId = settings.tasksCalendarId ?? "primary";
  let updated = 0;
  let deleted = 0;
  let skipped = 0;
  const errors: string[] = [];

  try {
    // Fetch ALL BOSS task events from Google Calendar — including cancelled ones
    // We need showDeleted=true to get cancelled events so we can detect GCal-side deletions
    let pageToken: string | undefined;
    const gcalActiveEvents: Array<{
      id: string;
      status: string;
      start?: { date?: string; dateTime?: string };
      end?: { date?: string; dateTime?: string };
      extendedProperties?: { private?: Record<string, string> };
    }> = [];
    const gcalDeletedEventIds = new Set<string>(); // GCal event IDs that are cancelled/deleted

    do {
      const params = new URLSearchParams({
        privateExtendedProperty: "bossType=task",
        maxResults: "250",
        singleEvents: "true",
        showDeleted: "true",  // ← include cancelled events so we can detect deletions
      });
      if (pageToken) params.set("pageToken", pageToken);

      const data = await gcalRequest(userId, "GET", `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
      for (const ev of (data?.items ?? [])) {
        if (ev.status === "cancelled") {
          gcalDeletedEventIds.add(ev.id);
        } else {
          gcalActiveEvents.push(ev);
        }
      }
      pageToken = data?.nextPageToken;
    } while (pageToken);

    // ── Step 1: Handle deleted events ─────────────────────────────────────────
    // Find all BOSS tasks that have a googleEventId matching a deleted GCal event
    if (gcalDeletedEventIds.size > 0) {
      const deletedIds = Array.from(gcalDeletedEventIds);
      // Process in batches of 100 to avoid huge IN clauses
      for (let i = 0; i < deletedIds.length; i += 100) {
        const batch = deletedIds.slice(i, i + 100);
        const affectedTasks = await db.select().from(tasks)
          .where(and(
            eq(tasks.userId, userId),
            inArray(tasks.googleEventId, batch)
          ));

        for (const task of affectedTasks) {
          // Skip tasks that are already done/cancelled — they were intentionally removed
          if (task.status === "done" || task.status === "cancelled") {
            skipped++;
            continue;
          }
          // Loop prevention: if we just synced this task within 30s, it was our own delete
          if (task.lastSyncedAt) {
            const diffMs = Date.now() - task.lastSyncedAt.getTime();
            if (diffMs < 30_000) {
              skipped++;
              continue;
            }
          }

          // GCal event was deleted by user → soft-delete the task in BOSS OS (Undo possible)
          await db.update(tasks).set({ deletedAt: new Date() }).where(and(eq(tasks.id, task.id), eq(tasks.userId, userId)));

          deleted++;
          console.log(`[GCal Pull] Task ${task.id} "${task.name}": GCal event deleted → task deleted from BOSS OS`);
        }
      }
    }

    // ── Step 2: Handle moved events (date changed) ────────────────────────────
    for (const ev of gcalActiveEvents) {
      const bossTaskId = ev.extendedProperties?.private?.bossTaskId;
      if (!bossTaskId) { skipped++; continue; }

      const taskId = parseInt(bossTaskId, 10);
      if (isNaN(taskId)) { skipped++; continue; }

      // Get the date from GCal event (all-day events use .date, timed events use .dateTime)
      const gcalDateStr = ev.start?.date ?? ev.start?.dateTime?.split("T")[0];
      const gcalEndStr = ev.end?.date ?? ev.end?.dateTime?.split("T")[0];
      if (!gcalDateStr) { skipped++; continue; }

      // Parse to Bangkok noon UTC
      const gcalDueDate = new Date(`${gcalDateStr}T05:00:00.000Z`); // Bangkok noon (UTC+7 12:00 = UTC 05:00)
      const gcalStartDate = gcalEndStr && gcalEndStr !== gcalDateStr
        ? new Date(`${gcalDateStr}T05:00:00.000Z`) // Bangkok noon
        : null;

      // Fetch current task from DB
      const taskRows = await db.select().from(tasks)
        .where(eq(tasks.id, taskId))
        .limit(1);
      const task = taskRows[0];
      if (!task || task.userId !== userId) { skipped++; continue; }

      // Skip done/cancelled tasks
      if (task.status === "done" || task.status === "cancelled") { skipped++; continue; }

      // Compare dates — only update if GCal date differs from DB date
      const dbDueDateStr = task.dueDate ? toBangkokDateStr(task.dueDate) : null;
      const gcalDueDateStr = toBangkokDateStr(gcalDueDate);

      if (dbDueDateStr === gcalDueDateStr) { skipped++; continue; }

      // Date changed in GCal — update BOSS OS task
      const updateData: Partial<typeof tasks.$inferInsert> = {
        dueDate: gcalDueDate,
        lastSyncedAt: new Date(),
      };
      if (gcalStartDate) {
        updateData.startDate = gcalStartDate;
      }

      await db.update(tasks)
        .set(updateData)
        .where(eq(tasks.id, taskId));

      updated++;
      console.log(`[GCal Pull] Task ${taskId} "${task.name}": ${dbDueDateStr} → ${gcalDueDateStr}`);
    }
  } catch (e) {
    errors.push(String(e));
    console.error("[GCal Pull] Error:", e);
  }

  return { updated, deleted, skipped, errors };
}

// ─── Express Routes ───────────────────────────────────────────────────────────
// ─── Web Standard Handlers ───────────────────────────────────────────────────────────
export async function googleAuthHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const returnTo = url.searchParams.get("returnTo") || "/settings/calendar";
  const redirectUri = getRedirectUri(req);

  let userId: number | null = null;
  try {
    const user = await sdk.authenticateRequest(req);
    userId = user?.id ?? null;
  } catch {}

  if (!userId) {
    return Response.json({ error: "Not authenticated" }, { status: 401 });
  }

  const state = Buffer.from(JSON.stringify({ userId, returnTo })).toString("base64url");

  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: GOOGLE_SCOPES,
    access_type: "offline",
    prompt: "consent",
    state,
  });

  return Response.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${params}`, 302);
}

// ─── One-time cleanup: delete ALL BOSS events from GCal, then re-sync only active tasks ───
export async function googleCleanupSyncHandler(req: Request): Promise<Response> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user?.id) return Response.json({ error: "Not authenticated" }, { status: 401 });

    const db = await getDb();
    if (!db) return Response.json({ error: "DB not available" }, { status: 500 });

    const settingsRows = await db.select().from(calendarSettings).where(eq(calendarSettings.userId, user.id)).limit(1);
    const settings = settingsRows[0];
    if (!settings?.accessToken) return Response.json({ error: "Not connected to Google Calendar" }, { status: 400 });

    const calendarId = settings.tasksCalendarId ?? "primary";
    let deleted = 0;
    let resynced = 0;
    const errors: string[] = [];
      // Step 1: Find all BOSS events in GCal via extendedProperties search
      try {
        let pageToken: string | undefined;
        const bossEventIds: string[] = [];

        do {
          const params = new URLSearchParams({
            privateExtendedProperty: "bossType=task",
            maxResults: "250",
          });
          if (pageToken) params.set("pageToken", pageToken);

          const data = await gcalRequest(user.id, "GET", `/calendars/${encodeURIComponent(calendarId)}/events?${params}`);
          for (const ev of (data?.items ?? [])) {
            bossEventIds.push(ev.id);
          }
          pageToken = data?.nextPageToken;
        } while (pageToken);

        // Delete all found BOSS events
        for (const evId of bossEventIds) {
          try {
            await gcalRequest(user.id, "DELETE", `/calendars/${encodeURIComponent(calendarId)}/events/${evId}`);
            deleted++;
          } catch {}
        }
      } catch (e) {
        errors.push(`Cleanup step failed: ${String(e)}`);
      }

      // Step 2: Clear googleEventId from all task rows for this user
      await db.update(tasks)
        .set({ googleEventId: null, calendarSyncStatus: null, lastSyncedAt: null })
        .where(eq(tasks.userId, user.id));

      // Step 3: Re-sync only active (non-done, non-cancelled) tasks with a date
      if (settings.syncTasks) {
        const activeTasks = await db.select().from(tasks)
          .where(eq(tasks.userId, user.id))
          .limit(500);

        for (const task of activeTasks) {
          if (task.status === "done" || task.status === "cancelled") continue;
          if (!task.dueDate && !task.startDate) continue;
          try {
            const eventId = await pushTaskToCalendar(user.id, {
              id: task.id,
              name: task.name,
              description: task.description,
              dueDate: task.dueDate,
              startDate: task.startDate,
              status: task.status,
              priority: task.priority,
              googleEventId: null, // force create new
            }, calendarId);
            if (eventId) resynced++;
          } catch (e) {
            errors.push(`Task ${task.name}: ${String(e)}`);
          }
        }
      }

    return Response.json({ ok: true, deleted, resynced, errors: errors.slice(0, 20) });
  } catch (e) {
    console.error("[GCal Cleanup] Fatal:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

/**
 * Scheduled handler for periodic Google Calendar sync (called by Heartbeat cron).
 */
export async function gcalSyncHandler(req: Request): Promise<Response> {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user?.isCron) {
      return Response.json({ error: "cron-only" }, { status: 403 });
    }

    const db = await getDb();
    if (!db) return Response.json({ error: "DB not available" }, { status: 500 });

      const allSettings = await db.select().from(calendarSettings)
        .where(eq(calendarSettings.syncEnabled, true));

      let totalTasksSynced = 0;
      let totalProjectsSynced = 0;
      let usersProcessed = 0;
      const errors: string[] = [];

      for (const settings of allSettings) {
        if (!settings.accessToken) continue;
        const userId = settings.userId;
        usersProcessed++;

        try {
          // Sync tasks — only active ones
          if (settings.syncTasks) {
            const userTasks = await db.select().from(tasks)
              .where(eq(tasks.userId, userId))
              .limit(200);

            for (const task of userTasks) {
              if (!task.dueDate && !task.startDate) continue;

              // If done/cancelled: delete from GCal if it has an event
              if (task.status === "done" || task.status === "cancelled") {
                if (task.googleEventId) {
                  try {
                    await deleteTaskFromCalendar(userId, task.googleEventId, settings.tasksCalendarId ?? "primary");
                    await db.update(tasks)
                      .set({ googleEventId: null, calendarSyncStatus: null })
                      .where(eq(tasks.id, task.id));
                  } catch {}
                }
                continue;
              }

              try {
                const eventId = await pushTaskToCalendar(userId, {
                  id: task.id,
                  name: task.name,
                  description: task.description,
                  dueDate: task.dueDate,
                  startDate: task.startDate,
                  status: task.status,
                  priority: task.priority,
                  googleEventId: task.googleEventId ?? null,  // ← correct field
                }, settings.tasksCalendarId ?? "primary");
                if (eventId) totalTasksSynced++;
              } catch (e) {
                errors.push(`User ${userId} Task ${task.name}: ${String(e)}`);
              }
            }
          }

          // Sync projects
          if (settings.syncProjects) {
            const userProjects = await db.select().from(projects)
              .where(eq(projects.userId, userId))
              .limit(100);

            for (const project of userProjects) {
              if (!project.deadline && !project.startDate) continue;
              try {
                const eventId = await pushProjectToCalendar(userId, {
                  id: project.id,
                  name: project.name,
                  deadline: project.deadline,
                  startDate: project.startDate,
                  status: project.status,
                  googleEventId: null, // projects don't have googleEventId in schema yet
                }, settings.projectsCalendarId ?? "primary");
                if (eventId) totalProjectsSynced++;
              } catch (e) {
                errors.push(`User ${userId} Project ${project.name}: ${String(e)}`);
              }
            }
          }

          await db.update(calendarSettings)
            .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
            .where(eq(calendarSettings.userId, userId));

        } catch (e) {
          errors.push(`User ${userId}: ${String(e)}`);
        }
      }

    console.log(`[GCal Periodic Sync] Users: ${usersProcessed}, Tasks: ${totalTasksSynced}, Projects: ${totalProjectsSynced}`);
    return Response.json({
      ok: true,
      usersProcessed,
      totalTasksSynced,
      totalProjectsSynced,
      errors: errors.slice(0, 20),
      timestamp: new Date().toISOString(),
    });
  } catch (e) {
    console.error("[GCal Periodic Sync] Fatal error:", e);
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// Step 2: OAuth callback from Google
export async function googleCallbackHandler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const stateRaw = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  if (error) {
    return Response.redirect(`/settings/calendar?error=${encodeURIComponent(error)}`, 302);
  }

  if (!code || !stateRaw) {
    return Response.redirect("/settings/calendar?error=missing_params", 302);
  }

  let state: { userId: number; returnTo: string };
  try {
    state = JSON.parse(Buffer.from(stateRaw, "base64url").toString());
  } catch {
    return Response.redirect("/settings/calendar?error=invalid_state", 302);
  }

  const redirectUri = getRedirectUri(req);

  try {
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = await tokenResp.json() as any;
    if (!tokens.access_token) {
      throw new Error("No access token in response");
    }

    const expiry = new Date(Date.now() + (tokens.expires_in ?? 3600) * 1000);
    const db = await getDb();
    if (!db) throw new Error("DB not available");

    await db.insert(calendarSettings).values({
      userId: state.userId,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      tokenExpiry: expiry,
      syncEnabled: true,
    }).onConflictDoUpdate({
      target: calendarSettings.userId,
      set: {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token ?? null,
        tokenExpiry: expiry,
        syncEnabled: true,
        updatedAt: new Date(),
      },
    });

    // Reset any error outbox jobs so they get retried now that we have a fresh token
    try {
      const { eq: eqOp } = await import("drizzle-orm");
      await db.update(taskSyncOutbox)
        .set({ status: "pending", attempts: 0, nextRetryAt: new Date(), lastError: null })
        .where(
          eqOp(taskSyncOutbox.userId, state.userId)
        );
      console.log("[Google Calendar] Reconnected — reset all outbox jobs to pending for user", state.userId);
    } catch (resetErr) {
      console.warn("[Google Calendar] Could not reset outbox jobs:", resetErr);
    }

    return Response.redirect(`${state.returnTo}?connected=true`, 302);
  } catch (e) {
    console.error("[Google Calendar] Callback failed:", e);
    return Response.redirect(`/settings/calendar?error=token_exchange_failed`, 302);
  }
}

