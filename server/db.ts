import { and, asc, desc, eq, gte, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, DrizzleD1Database } from "drizzle-orm/d1";
import { areas, importLogs, InsertArea, InsertNote, InsertProject, InsertTask, InsertUser, notes, projects, tasks, users } from "../drizzle/schema";
import { ENV } from "./_core/env";

export const dbStorage = new AsyncLocalStorage<DrizzleD1Database>();

export async function getDb(): Promise<DrizzleD1Database | null> {
  const db = dbStorage.getStore();
  if (!db) {
    console.warn("[Database] No D1 Database instance found in AsyncLocalStorage.");
  }
  return db ?? null;
}

// ─── Users ────────────────────────────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;
  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach((field) => {
    const value = user[field];
    if (value === undefined) return;
    const normalized = value ?? null;
    values[field] = normalized;
    updateSet[field] = normalized;
  });
  if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
  if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
  else if (user.openId === ENV.ownerOpenId) { values.role = "admin"; updateSet.role = "admin"; }
  if (!values.lastSignedIn) values.lastSignedIn = new Date();
  if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
  await db.insert(users).values(values).onConflictDoUpdate({ target: users.openId, set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

// ─── Areas ────────────────────────────────────────────────────────────────────
export async function getAreas(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(areas).where(eq(areas.userId, userId)).orderBy(asc(areas.sortOrder), asc(areas.createdAt));
}

export async function getAreaById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(areas).where(and(eq(areas.id, id), eq(areas.userId, userId))).limit(1);
  return result[0];
}

export async function createArea(data: InsertArea) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(areas).values(data).returning({ insertId: areas.id });
  return result[0];
}

export async function updateArea(id: number, userId: number, data: Partial<InsertArea>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(areas).set(data).where(and(eq(areas.id, id), eq(areas.userId, userId)));
}

export async function deleteArea(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(areas).where(and(eq(areas.id, id), eq(areas.userId, userId)));
}

// ─── Projects ─────────────────────────────────────────────────────────────────
export async function getProjects(userId: number, areaId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(projects.userId, userId)];
  if (areaId !== undefined) conditions.push(eq(projects.areaId, areaId));
  return db.select().from(projects).where(and(...conditions)).orderBy(asc(projects.sortOrder), asc(projects.createdAt));
}

export async function getProjectById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(projects).where(and(eq(projects.id, id), eq(projects.userId, userId))).limit(1);
  return result[0];
}

export async function createProject(data: InsertProject) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(projects).values(data).returning({ insertId: projects.id });
  // Return full result so callers can access result[0].insertId (ResultSetHeader)
  return result;
}

export async function updateProject(id: number, userId: number, data: Partial<InsertProject>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(projects).set(data).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

export async function deleteProject(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(projects).where(and(eq(projects.id, id), eq(projects.userId, userId)));
}

export async function recalcProjectProgress(projectId: number, userId: number) {
  const db = await getDb();
  if (!db) return;
  const allTasks = await db.select().from(tasks).where(and(eq(tasks.projectId, projectId), eq(tasks.userId, userId), isNull(tasks.parentTaskId), isNull(tasks.deletedAt)));
  if (allTasks.length === 0) return;
  const done = allTasks.filter((t) => t.status === "done").length;
  const progress = done / allTasks.length;
  await db.update(projects).set({ progress }).where(eq(projects.id, projectId));
}

// ─── Tasks ────────────────────────────────────────────────────────────────────
export async function getTasks(userId: number, filters?: { projectId?: number; areaId?: number; status?: string; assignToday?: boolean; parentTaskId?: number | null }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(tasks.userId, userId), isNull(tasks.deletedAt)];
  if (filters?.projectId !== undefined) conditions.push(eq(tasks.projectId, filters.projectId));
  if (filters?.areaId !== undefined) conditions.push(eq(tasks.areaId, filters.areaId));
  if (filters?.status !== undefined) conditions.push(eq(tasks.status, filters.status as any));
  if (filters?.assignToday !== undefined) conditions.push(eq(tasks.assignToday, filters.assignToday));
  if (filters?.parentTaskId === null) conditions.push(isNull(tasks.parentTaskId));
  else if (filters?.parentTaskId !== undefined) conditions.push(eq(tasks.parentTaskId, filters.parentTaskId));
  return db.select().from(tasks).where(and(...conditions)).orderBy(desc(tasks.autoPriorityScore), asc(tasks.dueDate), asc(tasks.sortOrder));
}

export async function getTaskById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).limit(1);
  return result[0];
}

export async function createTask(data: InsertTask) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const score = computePriorityScore(data);
  const priority = scoreToPriority(score);
  const result = await db.insert(tasks).values({ ...data, autoPriorityScore: score, priority }).returning({ insertId: tasks.id });
  // Return full result so callers can access result[0].insertId (ResultSetHeader)
  return result;
}

export async function updateTask(id: number, userId: number, data: Partial<InsertTask>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const existing = await getTaskById(id, userId);
  if (!existing) throw new Error("Task not found");
  const merged = { ...existing, ...data };
  const score = computePriorityScore(merged);
  const priority = data.manualPriorityOverride ?? scoreToPriority(score);
  await db.update(tasks).set({ ...data, autoPriorityScore: score, priority }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  if (merged.projectId) await recalcProjectProgress(merged.projectId, userId);
}

export async function deleteTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const task = await getTaskById(id, userId);
  // Soft-delete: set deletedAt instead of hard-deleting, so Undo is possible within 30 days
  await db.update(tasks).set({ deletedAt: new Date() }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  if (task?.projectId) await recalcProjectProgress(task.projectId, userId);
}

export async function restoreTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(tasks).set({ deletedAt: null }).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
  const task = await db.select().from(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId))).limit(1);
  if (task[0]?.projectId) await recalcProjectProgress(task[0].projectId, userId);
}

export async function hardDeleteTask(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(tasks).where(and(eq(tasks.id, id), eq(tasks.userId, userId)));
}

export async function getTasksDueToday(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
  const rows = await db
    .select({ task: tasks, projectName: projects.name })
    .from(tasks)
    .leftJoin(projects, eq(tasks.projectId, projects.id))
    .where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt), gte(tasks.dueDate, todayStart), lte(tasks.dueDate, todayEnd)));
  return rows.map(r => ({ ...r.task, projectName: r.projectName ?? null }));
}

export async function getOverdueTasks(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const now = new Date();
  return db.select().from(tasks).where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt), lte(tasks.dueDate, now), sql`${tasks.status} != 'done'`, sql`${tasks.status} != 'cancelled'`));
}

export async function getTasksInRange(userId: number, start: Date, end: Date) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(tasks).where(and(eq(tasks.userId, userId), isNull(tasks.deletedAt), or(and(gte(tasks.dueDate, start), lte(tasks.dueDate, end)), and(gte(tasks.startDate, start), lte(tasks.startDate, end)))));
}

// ─── Priority Engine ──────────────────────────────────────────────────────────
export function computePriorityScore(task: Partial<InsertTask>): number {
  const urgency = (task.urgency ?? 3) / 5;
  const impact = (task.impact ?? 3) / 5;
  const effort = (task.effort ?? 3) / 5;
  const alignment = (task.strategicAlignment ?? 3) / 5;

  // Deadline risk: 0-1 based on days remaining
  let deadlineRisk = 0;
  if (task.dueDate) {
    const daysLeft = (new Date(task.dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
    if (daysLeft < 0) deadlineRisk = 1;
    else if (daysLeft <= 1) deadlineRisk = 0.95;
    else if (daysLeft <= 3) deadlineRisk = 0.8;
    else if (daysLeft <= 7) deadlineRisk = 0.6;
    else if (daysLeft <= 14) deadlineRisk = 0.4;
    else deadlineRisk = 0.1;
  }

  // Effort efficiency: high impact with low effort = high score
  const effortEfficiency = impact * (1 - effort * 0.3);

  const score =
    urgency * 25 +
    impact * 25 +
    alignment * 15 +
    deadlineRisk * 15 +
    effortEfficiency * 10 +
    (1 - effort * 0.2) * 10;

  return Math.min(100, Math.max(0, score));
}

export function scoreToPriority(score: number): "p0" | "p1" | "p2" | "p3" {
  if (score >= 80) return "p0";
  if (score >= 60) return "p1";
  if (score >= 35) return "p2";
  return "p3";
}

// ─── Notes ────────────────────────────────────────────────────────────────────
export async function getNotes(userId: number, filters?: { areaId?: number; projectId?: number; taskId?: number; isArchived?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  const conditions = [eq(notes.userId, userId)];
  if (filters?.areaId !== undefined) conditions.push(eq(notes.areaId, filters.areaId));
  if (filters?.projectId !== undefined) conditions.push(eq(notes.projectId, filters.projectId));
  if (filters?.taskId !== undefined) conditions.push(eq(notes.taskId, filters.taskId));
  if (filters?.isArchived !== undefined) conditions.push(eq(notes.isArchived, filters.isArchived));
  return db.select().from(notes).where(and(...conditions)).orderBy(desc(notes.createdAt));
}

export async function getNoteById(id: number, userId: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(notes).where(and(eq(notes.id, id), eq(notes.userId, userId))).limit(1);
  return result[0];
}

export async function createNote(data: InsertNote) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(notes).values(data).returning({ insertId: notes.id });
  return result[0];
}

export async function updateNote(id: number, userId: number, data: Partial<InsertNote>) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.update(notes).set(data).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}

export async function deleteNote(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  await db.delete(notes).where(and(eq(notes.id, id), eq(notes.userId, userId)));
}

// ─── Dashboard Stats ──────────────────────────────────────────────────────────
export async function getDashboardStats(userId: number) {
  const db = await getDb();
  if (!db) return null;

  const [allProjects, allTasks, todayTasks, overdueTasks] = await Promise.all([
    db.select().from(projects).where(eq(projects.userId, userId)),
    db.select().from(tasks).where(and(eq(tasks.userId, userId), isNull(tasks.parentTaskId), isNull(tasks.deletedAt))),
    getTasksDueToday(userId),
    getOverdueTasks(userId),
  ]);

  const activeProjects = allProjects.filter((p) => p.status === "in_progress").length;
  const completedTasks = allTasks.filter((t) => t.status === "done").length;
  const completionRate = allTasks.length > 0 ? (completedTasks / allTasks.length) * 100 : 0;

  return {
    totalProjects: allProjects.length,
    activeProjects,
    totalTasks: allTasks.length,
    completedTasks,
    tasksDueToday: todayTasks.length,
    overdueTasks: overdueTasks.length,
    completionRate: Math.round(completionRate),
  };
}

// ─── Import Logs ──────────────────────────────────────────────────────────────
export async function createImportLog(data: { userId: number; filename?: string; importType: "notion_project_csv" | "notion_task_csv" | "notion_zip" }) {
  const db = await getDb();
  if (!db) throw new Error("DB not available");
  const result = await db.insert(importLogs).values({ ...data, status: "pending" }).returning({ insertId: importLogs.id });
  return result[0];
}

export async function updateImportLog(id: number, data: Partial<typeof importLogs.$inferInsert>) {
  const db = await getDb();
  if (!db) return;
  await db.update(importLogs).set(data).where(eq(importLogs.id, id));
}
