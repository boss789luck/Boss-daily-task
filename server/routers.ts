import { COOKIE_NAME } from "@shared/const";
import { z } from "zod";
import "./services/googleCalendarSync";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  computePriorityScore,
  createArea,
  createImportLog,
  createNote,
  createProject,
  createTask,
  deleteArea,
  deleteNote,
  deleteProject,
  deleteTask,
  getAreaById,
  getAreas,
  getDashboardStats,
  getNoteById,
  getNotes,
  getOverdueTasks,
  getProjectById,
  getProjects,
  getTaskById,
  getTasks,
  getTasksDueToday,
  getTasksInRange,
  scoreToPriority,
  updateArea,
  updateImportLog,
  updateNote,
  updateProject,
  updateTask,
} from "./db";
import { getDb } from "./db";
import { areas, notes, projects, tasks, calendarSettings, taskSyncOutbox } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { listUserCalendars, pushTaskToCalendar, pushProjectToCalendar, refreshGoogleToken, autoSyncTask, autoDeleteTask, autoSyncProject, autoDeleteProject, pullFromGoogleCalendar, gcalRequest } from "./googleCalendar";
import { taskEventBus, type TaskChangedEvent } from "./services/taskService";
import { createTaskAndSync, updateTaskAndSync, deleteTaskAndSync, toggleTaskDoneAndSync, restoreTaskAndSync } from "./services/taskService";
import { habitsRouter } from "./routers/habits";
import { lifeGoalsRouter } from "./routers/lifeGoals";
import { bookSummariesRouter } from "./routers/bookSummaries";
import { cardManagerRouter } from "./routers/cardManager";
import { timeTrackerRouter } from "./routers/timeTracker";

// ─── Shared Zod schemas ───────────────────────────────────────────────────────
const areaInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  color: z.string().optional(),
  icon: z.string().optional(),
  sortOrder: z.number().optional(),
});

const projectInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().optional(),
  areaId: z.number().optional().nullable(),
  status: z.enum(["not_started","planning","in_progress","waiting","blocked","on_hold","completed","archived"]).optional(),
  priority: z.enum(["p0","p1","p2","p3"]).optional(),
  health: z.enum(["on_track","at_risk","delayed","critical"]).optional(),
  progress: z.number().min(0).max(1).optional(),
  startDate: z.date().optional().nullable(),
  deadline: z.date().optional().nullable(),
  defaultCalendarId: z.string().optional().nullable(),
  riskLevel: z.enum(["low","medium","high","critical"]).optional(),
  sortOrder: z.number().optional(),
});

const taskInput = z.object({
  name: z.string().min(1).max(500),
  description: z.string().optional().nullable(),
  areaId: z.number().optional().nullable(),
  projectId: z.number().optional().nullable(),
  parentTaskId: z.number().optional().nullable(),
  status: z.enum(["inbox","not_started","next_action","in_progress","waiting","blocked","review","done","cancelled"]).optional(),
  urgency: z.number().min(1).max(5).optional(),
  impact: z.number().min(1).max(5).optional(),
  effort: z.number().min(1).max(5).optional(),
  strategicAlignment: z.number().min(1).max(5).optional(),
  manualPriorityOverride: z.enum(["p0","p1","p2","p3"]).optional().nullable(),
  dueDate: z.date().optional().nullable(),
  startDate: z.date().optional().nullable(),
  startTime: z.string().optional().nullable(),
  endTime: z.string().optional().nullable(),
  estimatedDuration: z.number().optional().nullable(),
  assignToday: z.boolean().optional(),
  assignee: z.string().optional().nullable(),
  progressPct: z.number().min(0).max(100).optional(),
  tags: z.string().optional().nullable(),
  recurrenceRule: z.string().optional().nullable(),
  sortOrder: z.number().optional(),
  eisenhowerQuadrant: z.enum(["do_first","schedule","delegate","eliminate"]).optional().nullable(),
});

const noteInput = z.object({
  title: z.string().min(1).max(500),
  content: z.string().optional().nullable(),
  areaId: z.number().optional().nullable(),
  projectId: z.number().optional().nullable(),
  taskId: z.number().optional().nullable(),
  tags: z.string().optional().nullable(),
  attachmentUrl: z.string().optional().nullable(),
  externalUrl: z.string().optional().nullable(),
  isArchived: z.boolean().optional(),
  noteDate: z.date().optional().nullable(),
});

// ─── App Router ───────────────────────────────────────────────────────────────
export const appRouter = router({
  system: systemRouter,

  auth: router({
    me: publicProcedure.query((opts) => opts.ctx.user),
    logout: publicProcedure.mutation(({ ctx }) => {
      ctx.resHeaders.append("Set-Cookie", `${COOKIE_NAME}=; Path=/; Max-Age=0`);
      return { success: true } as const;
    }),
  }),

  // ─── Dashboard ──────────────────────────────────────────────────────────────
  dashboard: router({
    stats: protectedProcedure.query(({ ctx }) => getDashboardStats(ctx.user.id)),
    todayTasks: protectedProcedure.query(({ ctx }) => getTasksDueToday(ctx.user.id)),
    overdueTasks: protectedProcedure.query(({ ctx }) => getOverdueTasks(ctx.user.id)),
  }),

  // ─── Areas ──────────────────────────────────────────────────────────────────
  areas: router({
    list: protectedProcedure.query(({ ctx }) => getAreas(ctx.user.id)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => getAreaById(input.id, ctx.user.id)),
    create: protectedProcedure.input(areaInput).mutation(({ ctx, input }) =>
      createArea({ ...input, userId: ctx.user.id })
    ),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: areaInput.partial() }))
      .mutation(({ ctx, input }) => updateArea(input.id, ctx.user.id, input.data)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteArea(input.id, ctx.user.id)),
  }),

  // ─── Projects ───────────────────────────────────────────────────────────────
  projects: router({
    list: protectedProcedure
      .input(z.object({ areaId: z.number().optional() }).optional())
      .query(({ ctx, input }) => getProjects(ctx.user.id, input?.areaId)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => getProjectById(input.id, ctx.user.id)),
    create: protectedProcedure.input(projectInput).mutation(async ({ ctx, input }) => {
      const result = await createProject({ ...input, userId: ctx.user.id });
      // createProject now returns the full drizzle result array; result[0] is ResultSetHeader with insertId
      const insertId = (result as any)?.[0]?.insertId;
      if (insertId) {
        const project = await getProjectById(insertId, ctx.user.id);
        if (project) {
          await autoSyncProject(ctx.user.id, {
            id: project.id,
            name: project.name,
            description: project.description,
            deadline: project.deadline,
            startDate: project.startDate,
            status: project.status,
            googleEventId: null,
          }).catch(() => {});
        }
      }
      return result;
    }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: projectInput.partial() }))
      .mutation(async ({ ctx, input }) => {
        const project = await updateProject(input.id, ctx.user.id, input.data);
        // Auto-sync updated project to Google Calendar
        const updated = await import("./db").then(m => m.getProjectById(input.id, ctx.user.id));
        if (updated) {
          await autoSyncProject(ctx.user.id, {
            id: updated.id,
            name: updated.name,
            description: updated.description,
            deadline: updated.deadline,
            startDate: updated.startDate,
            status: updated.status,
            googleEventId: null,
          }).catch(() => {});
        }
        return project;
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        // Fetch googleEventId before deleting
        // const project = await import("./db").then(m => m.getProjectById(input.id, ctx.user.id));
        const result = await deleteProject(input.id, ctx.user.id);
        // Auto-delete from Google Calendar (Projects do not have googleEventId yet)
        return result;
      }),
    reorder: protectedProcedure
      .input(z.object({ orderedIds: z.array(z.number()) }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) return { success: false };
        await Promise.all(
          input.orderedIds.map((id, index) =>
            db.update(projects)
              .set({ sortOrder: index })
              .where(and(eq(projects.id, id), eq(projects.userId, ctx.user.id)))
          )
        );
        return { success: true };
      }),
  }),

  // ─── Tasks ──────────────────────────────────────────────────────────────────
  tasks: router({
    list: protectedProcedure
      .input(z.object({
        projectId: z.number().optional(),
        areaId: z.number().optional(),
        status: z.string().optional(),
        assignToday: z.boolean().optional(),
        parentTaskId: z.number().nullable().optional(),
      }).optional())
      .query(({ ctx, input }) => getTasks(ctx.user.id, input)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => getTaskById(input.id, ctx.user.id)),
    inRange: protectedProcedure
      .input(z.object({ start: z.date(), end: z.date() }))
      .query(({ ctx, input }) => getTasksInRange(ctx.user.id, input.start, input.end)),
    create: protectedProcedure.input(taskInput).mutation(async ({ ctx, input }) => {
      const { id } = await createTaskAndSync({ ...input, userId: ctx.user.id });
      return { id };
    }),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: taskInput.partial() }))
      .mutation(async ({ ctx, input }) => {
        await updateTaskAndSync(input.id, ctx.user.id, input.data);
        return getTaskById(input.id, ctx.user.id);
      }),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await deleteTaskAndSync(input.id, ctx.user.id);
        return { success: true, taskId: input.id };
      }),
    restore: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await restoreTaskAndSync(input.id, ctx.user.id);
        return { success: true, taskId: input.id };
      }),
    toggleDone: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        await toggleTaskDoneAndSync(input.id, ctx.user.id);
        const updated = await getTaskById(input.id, ctx.user.id);
        return { status: updated?.status ?? "done" };
      }),
    scorePreview: protectedProcedure
      .input(z.object({ urgency: z.number(), impact: z.number(), effort: z.number(), strategicAlignment: z.number(), dueDate: z.date().optional() }))
      .query(({ input }) => {
        const score = computePriorityScore(input);
        return { score: Math.round(score), priority: scoreToPriority(score) };
      }),
    bulkAssignToday: protectedProcedure
      .input(z.object({ ids: z.array(z.number()), assignToday: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        for (const id of input.ids) {
          await updateTask(id, ctx.user.id, { assignToday: input.assignToday });
        }
        return { updated: input.ids.length };
      }),
    // ─── SSE subscription: fires whenever any task changes for this user ─────
    onChanged: protectedProcedure.subscription(async function* ({ ctx }) {
      const userId = ctx.user.id;
      const queue: TaskChangedEvent[] = [];
      let resolve: (() => void) | null = null;
      const listener = (event: TaskChangedEvent) => {
        queue.push(event);
        resolve?.();
        resolve = null;
      };
      taskEventBus.on(`task.changed:${userId}`, listener);
      try {
        while (true) {
          while (queue.length > 0) {
            yield queue.shift()!;
          }
          await new Promise<void>((r) => { resolve = r; });
        }
      } finally {
        taskEventBus.off(`task.changed:${userId}`, listener);
      }
    }),
  }),

  // ─── Notes ──────────────────────────────────────────────────────────────────
  notes: router({
    list: protectedProcedure
      .input(z.object({
        areaId: z.number().optional(),
        projectId: z.number().optional(),
        taskId: z.number().optional(),
        isArchived: z.boolean().optional(),
      }).optional())
      .query(({ ctx, input }) => getNotes(ctx.user.id, input)),
    byId: protectedProcedure.input(z.object({ id: z.number() })).query(({ ctx, input }) => getNoteById(input.id, ctx.user.id)),
    create: protectedProcedure.input(noteInput).mutation(({ ctx, input }) =>
      createNote({ ...input, userId: ctx.user.id })
    ),
    update: protectedProcedure
      .input(z.object({ id: z.number(), data: noteInput.partial() }))
      .mutation(({ ctx, input }) => updateNote(input.id, ctx.user.id, input.data)),
    delete: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(({ ctx, input }) => deleteNote(input.id, ctx.user.id)),
    toggleArchive: protectedProcedure
      .input(z.object({ id: z.number() }))
      .mutation(async ({ ctx, input }) => {
        const note = await getNoteById(input.id, ctx.user.id);
        if (!note) throw new Error("Note not found");
        await updateNote(input.id, ctx.user.id, { isArchived: !note.isArchived });
        return { isArchived: !note.isArchived };
      }),
  }),

  // ─── Google Calendar ────────────────────────────────────────────────────────
  googleCalendar: router({
    // Get current calendar settings for the logged-in user
    getSettings: protectedProcedure.query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return null;
      const rows = await db.select().from(calendarSettings).where(eq(calendarSettings.userId, ctx.user.id)).limit(1);
      const s = rows[0];
      if (!s) return null;
      return {
        connected: !!s.accessToken,
        syncEnabled: s.syncEnabled,
        syncTasks: s.syncTasks,
        syncProjects: s.syncProjects,
        tasksCalendarId: s.tasksCalendarId ?? "primary",
        projectsCalendarId: s.projectsCalendarId ?? "primary",
        lastSyncedAt: s.lastSyncedAt,
      };
    }),

    // Save calendar settings (Calendar IDs + sync preferences)
    saveSettings: protectedProcedure
      .input(z.object({
        tasksCalendarId: z.string().min(1),
        projectsCalendarId: z.string().min(1),
        syncEnabled: z.boolean(),
        syncTasks: z.boolean(),
        syncProjects: z.boolean(),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");
        await db.insert(calendarSettings).values({
          userId: ctx.user.id,
          ...input,
        }).onConflictDoUpdate({ target: calendarSettings.userId, set: { ...input, updatedAt: new Date() } });
        return { success: true };
      }),

    // List user's Google Calendars (for the dropdown picker)
    listCalendars: protectedProcedure.query(async ({ ctx }) => {
      return listUserCalendars(ctx.user.id);
    }),

    // Get events for a specific Google Calendar
    getEvents: protectedProcedure
      .input(z.object({
        calendarId: z.string().min(1),
        timeMin: z.string(),
        timeMax: z.string(),
      }))
      .query(async ({ ctx, input }) => {
        try {
          const encodedId = encodeURIComponent(input.calendarId);
          const data = await gcalRequest(
            ctx.user.id,
            "GET",
            `/calendars/${encodedId}/events?timeMin=${encodeURIComponent(input.timeMin)}&timeMax=${encodeURIComponent(input.timeMax)}&singleEvents=true&orderBy=startTime`
          );
          if (!data || !data.items) return [];

          return data.items.map((e: any) => {
            const start = e.start?.dateTime || e.start?.date;
            const end = e.end?.dateTime || e.end?.date;
            const isAllDay = !!e.start?.date;
            return {
              id: e.id,
              title: e.summary || "(No title)",
              start,
              end,
              isAllDay,
              description: e.description,
              location: e.location,
              htmlLink: e.htmlLink,
            };
          });
        } catch (e) {
          console.error(`[Google Calendar] getEvents error for user ${ctx.user.id}, calendar ${input.calendarId}:`, e);
          throw new Error("Failed to fetch events from Google Calendar");
        }
      }),

    // Disconnect Google Calendar (clear tokens)
    disconnect: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");
      await db.update(calendarSettings)
        .set({ accessToken: null, refreshToken: null, tokenExpiry: null, syncEnabled: false, updatedAt: new Date() })
        .where(eq(calendarSettings.userId, ctx.user.id));
      return { success: true };
    }),

    // Pull from Google Calendar → update BOSS OS task dates (reverse sync)
    pullSync: protectedProcedure.mutation(async ({ ctx }) => {
      const result = await pullFromGoogleCalendar(ctx.user.id);
      return result;
    }),

    // Sync now — push all tasks + projects to Google Calendar
    syncNow: protectedProcedure.mutation(async ({ ctx }) => {
      const db = await getDb();
      if (!db) throw new Error("DB not available");

      const settingsRows = await db.select().from(calendarSettings).where(eq(calendarSettings.userId, ctx.user.id)).limit(1);
      const settings = settingsRows[0];
            if (!settings?.accessToken) throw new Error("Not connected to Google Calendar");
      if (!settings.syncEnabled) throw new Error("Sync is disabled");

      // Reset any error/stuck outbox jobs so they get retried immediately
      await db.update(taskSyncOutbox)
        .set({ status: "pending", attempts: 0, nextRetryAt: new Date(), lastError: null })
        .where(eq(taskSyncOutbox.userId, ctx.user.id));

      let tasksSynced = 0;
      let projectsSynced = 0;
      const errors: string[] = [];

      // Sync tasks
      if (settings.syncTasks) {
        const userTasks = await db.select().from(tasks)
          .where(eq(tasks.userId, ctx.user.id))
          .limit(200);

        for (const task of userTasks) {
          if (!task.dueDate && !task.startDate) continue;
          try {
            const eventId = await pushTaskToCalendar(ctx.user.id, {
              id: task.id,
              name: task.name,
              description: task.description,
              dueDate: task.dueDate,
              startDate: task.startDate,
              status: task.status,
              googleEventId: task.googleEventId ?? null,
            }, settings.tasksCalendarId ?? "primary");
            if (eventId) tasksSynced++;
          } catch (e) {
            errors.push(`Task ${task.name}: ${String(e)}`);
          }
        }
      }

      // Sync projects
      if (settings.syncProjects) {
        const userProjects = await db.select().from(projects)
          .where(eq(projects.userId, ctx.user.id))
          .limit(100);

        for (const project of userProjects) {
          if (!project.deadline && !project.startDate) continue;
          try {
            const eventId = await pushProjectToCalendar(ctx.user.id, {
              id: project.id,
              name: project.name,
              deadline: project.deadline,
              startDate: project.startDate,
              status: project.status,
              googleEventId: null,
            }, settings.projectsCalendarId ?? "primary");
            if (eventId) projectsSynced++;
          } catch (e) {
            errors.push(`Project ${project.name}: ${String(e)}`);
          }
        }
      }

      // Update lastSyncedAt
      await db.update(calendarSettings)
        .set({ lastSyncedAt: new Date(), updatedAt: new Date() })
        .where(eq(calendarSettings.userId, ctx.user.id));

      return { tasksSynced, projectsSynced, errors: errors.slice(0, 10) };
    }),
  }),

  // ─── Import ──────────────────────────────────────────────────────────────────
  import: router({
    logs: protectedProcedure
      .query(async ({ ctx }) => {
        const db = await getDb();
        if (!db) return [];
        const { importLogs } = require("../drizzle/schema");
        const { eq, desc } = require("drizzle-orm");
        const rows = await db.select().from(importLogs).where(eq(importLogs.userId, ctx.user.id)).orderBy(desc(importLogs.createdAt)).limit(20);
        return rows.map((r: any) => ({
          id: r.id,
          fileName: r.filename ?? r.fileName ?? "unknown",
          status: r.status,
          projectsImported: r.importType?.includes("project") ? (r.importedRows ?? 0) : 0,
          tasksImported: r.importType?.includes("task") ? (r.importedRows ?? 0) : 0,
          errorMessage: r.errorMessage ?? null,
          createdAt: r.createdAt,
        }));
      }),
    notionCsv: protectedProcedure
      .input(z.object({
        fileContent: z.string(),
        fileName: z.string(),
        fileType: z.enum(["csv", "zip"]),
      }))
      .mutation(async ({ ctx, input }) => {
        const db = await getDb();
        if (!db) throw new Error("DB not available");

        // Detect type from filename
        const isProjectFile = input.fileName.toLowerCase().includes("project");
        const logType = isProjectFile ? "notion_project_csv" : "notion_task_csv";
        const logResult = await db.insert(require("../drizzle/schema").importLogs).values({
          userId: ctx.user.id,
          filename: input.fileName,
          importType: logType,
          status: "processing",
        }).returning({ insertId: require("../drizzle/schema").importLogs.id });

        // For zip, extract CSV content; for csv, use directly
        let csvContent = input.fileContent;
        if (input.fileType === "zip") {
          // Base64 encoded zip - we'll parse the raw CSV from the base64 string
          // Extract text content from base64
          try {
            const base64Data = input.fileContent.replace(/^data:[^;]+;base64,/, "");
            const decoded = Buffer.from(base64Data, "base64").toString("utf8");
            csvContent = decoded;
          } catch {
            csvContent = input.fileContent;
          }
        }

        const rows = parseNotionCsv(csvContent);
        let imported = 0;
        const errors: string[] = [];
        let projectsImported = 0;
        let tasksImported = 0;

        if (isProjectFile) {
          for (const row of rows) {
            try {
              const name = row["Name"] || row["Project Name"] || row["name"] || "";
              if (!name.trim()) continue;

              const statusRaw = (row["Status"] || "").toLowerCase().replace(/\s+/g, "_");
              const statusMap: Record<string, string> = {
                "not_started": "not_started", "not started": "not_started",
                "in_progress": "in_progress", "in progress": "in_progress",
                "planning": "planning", "waiting": "waiting",
                "blocked": "blocked", "on_hold": "on_hold",
                "completed": "completed", "archived": "archived",
              };
              const status = (statusMap[statusRaw] || "not_started") as any;

              const progressRaw = parseFloat(row["% Complete"] || row["Progress"] || "0");
              const progress = isNaN(progressRaw) ? 0 : Math.min(1, progressRaw > 1 ? progressRaw / 100 : progressRaw);

              let deadline: Date | null = null;
              const deadlineStr = row["Deadline"] || row["Due Date"] || "";
              if (deadlineStr) {
                const parsed = parseDateString(deadlineStr);
                if (parsed) deadline = parsed;
              }

              await createProject({
                userId: ctx.user.id,
                name: name.trim(),
                status,
                progress,
                deadline,
                description: row["Notes"] || row["Description"] || null,
              });
              imported++;
              projectsImported++;
            } catch (e) {
              errors.push(String(e));
            }
          }
        } else {
          for (const row of rows) {
            try {
              const name = row["Name"] || row["Task Name"] || row["name"] || "";
              if (!name.trim()) continue;

              const statusRaw = (row["Status"] || "").toLowerCase().replace(/\s+/g, "_");
              const statusMap: Record<string, string> = {
                "not_started": "not_started", "not started": "not_started",
                "in_progress": "in_progress", "in progress": "in_progress",
                "inbox": "inbox", "next_action": "next_action", "next action": "next_action",
                "waiting": "waiting", "blocked": "blocked", "review": "review",
                "done": "done", "cancelled": "cancelled",
              };
              const status = (statusMap[statusRaw] || "not_started") as any;

              const priorityRaw = (row["Priority"] || "").toLowerCase();
              const priorityMap: Record<string, string> = { "high": "p1", "medium": "p2", "low": "p3", "critical": "p0", "urgent": "p0" };
              const priority = (priorityMap[priorityRaw] || "p2") as any;

              let dueDate: Date | null = null;
              const dueDateStr = row["Due Date"] || row["Deadline"] || "";
              if (dueDateStr) {
                const parsed = parseDateString(dueDateStr);
                if (parsed) dueDate = parsed;
              }

              await createTask({
                userId: ctx.user.id,
                name: name.trim(),
                description: row["Description"] || row["Task Description"] || null,
                status,
                priority,
                dueDate,
                assignee: row["Assignee"] || null,
              });
              imported++;
              tasksImported++;
            } catch (e) {
              errors.push(String(e));
            }
          }
        }

        await db.update(require("../drizzle/schema").importLogs)
          .set({ status: "completed", totalRows: rows.length, importedRows: imported })
          .where(require("drizzle-orm").eq(require("../drizzle/schema").importLogs.id, logResult[0].insertId));

        return { total: rows.length, imported, projectsImported, tasksImported, errors: errors.slice(0, 10) };
      }),
  }),

  // ─── Habits ───────────────────────────────────────────────────────────────
  habits: habitsRouter,
  lifeGoals: lifeGoalsRouter,
  bookSummaries: bookSummariesRouter,
  cardManager: cardManagerRouter,
  timeTracker: timeTrackerRouter,
});

// ─── CSV Parser ───────────────────────────────────────────────────────────────
function parseNotionCsv(csvData: string): Record<string, string>[] {
  const lines = csvData.split("\n").filter((l) => l.trim());
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => {
      row[h.trim()] = (values[idx] || "").trim();
    });
    rows.push(row);
  }
  return rows;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      result.push(current); current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function parseDateString(str: string): Date | null {
  if (!str) return null;
  // Handle Thai date format: "29 กรกฎาคม 2568" -> convert Buddhist Era to CE
  const thaiMonths: Record<string, number> = {
    "มกราคม": 0, "กุมภาพันธ์": 1, "มีนาคม": 2, "เมษายน": 3,
    "พฤษภาคม": 4, "มิถุนายน": 5, "กรกฎาคม": 6, "สิงหาคม": 7,
    "กันยายน": 8, "ตุลาคม": 9, "พฤศจิกายน": 10, "ธันวาคม": 11,
  };
  for (const [monthName, monthIdx] of Object.entries(thaiMonths)) {
    if (str.includes(monthName)) {
      const parts = str.split(" ");
      const day = parseInt(parts[0]);
      const year = parseInt(parts[2]) - 543; // Convert Buddhist Era to CE
      if (!isNaN(day) && !isNaN(year)) {
        return new Date(year, monthIdx, day);
      }
    }
  }
  // Try standard date parsing
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

export type AppRouter = typeof appRouter;
