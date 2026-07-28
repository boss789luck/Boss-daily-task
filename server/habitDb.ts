/**
 * habitDb.ts — DB helpers for BOSS HABIT OS
 * All dates are stored as YYYY-MM-DD strings in Bangkok timezone (Asia/Bangkok).
 */
import { and, desc, eq, gte, lte } from "drizzle-orm";
import { bookRecords, habitLogs, habits, readingLogs } from "../drizzle/schema";
import { getDb } from "./db";

// ─── Timezone helper ──────────────────────────────────────────────────────────
export function toBangkokDateStr(date: Date = new Date()): string {
  return date.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
}

export function getBangkokMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { start, end };
}

// ─── Habits CRUD ──────────────────────────────────────────────────────────────
export async function getHabits(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(habits)
    .where(and(eq(habits.userId, userId), eq(habits.isArchived, false)))
    .orderBy(habits.sortOrder, habits.id);
}

export async function createHabit(
  userId: number,
  data: {
    name: string;
    icon?: string;
    color?: string;
    type: "frequency" | "time_limit" | "book" | "monthly_frequency";
    weeklyTarget?: number;
    monthlyTarget?: number;
    timeLimit?: string;
    isBeforeLimit?: boolean;
    scoreWeight?: number;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(habits).values({ userId, ...data }).returning({ insertId: habits.id });
  return result.insertId as number;
}

export async function updateHabit(
  userId: number,
  habitId: number,
  data: Partial<{
    name: string;
    icon: string;
    color: string;
    weeklyTarget: number;
    monthlyTarget: number;
    timeLimit: string;
    isBeforeLimit: boolean;
    scoreWeight: number;
    isActive: boolean;
    isArchived: boolean;
    sortOrder: number;
  }>
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(habits).set(data).where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
}

export async function deleteHabit(userId: number, habitId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.update(habits).set({ isArchived: true }).where(and(eq(habits.id, habitId), eq(habits.userId, userId)));
}

// ─── Habit Logs ───────────────────────────────────────────────────────────────
export async function getHabitLogsForMonth(userId: number, year: number, month: number) {
  const db = await getDb();
  if (!db) return [];
  const { start, end } = getBangkokMonthRange(year, month);
  return db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), gte(habitLogs.logDate, start), lte(habitLogs.logDate, end)));
}

export async function getHabitLogsForDate(userId: number, date: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.logDate, date)));
}

export async function upsertHabitLog(
  userId: number,
  habitId: number,
  logDate: string,
  data: {
    completed: boolean;
    activityType?: string;
    durationMinutes?: number;
    topic?: string;
    notes?: string;
    loggedTime?: string;
  }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  // Check if log exists
  const existing = await db
    .select()
    .from(habitLogs)
    .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, habitId), eq(habitLogs.logDate, logDate)))
    .limit(1);

  if (existing.length > 0) {
    await db
      .update(habitLogs)
      .set({ ...data })
      .where(and(eq(habitLogs.userId, userId), eq(habitLogs.habitId, habitId), eq(habitLogs.logDate, logDate)));
  } else {
    await db.insert(habitLogs).values({ userId, habitId, logDate, ...data });
  }
}

// ─── Book Records ─────────────────────────────────────────────────────────────
export async function getBookRecords(userId: number, habitId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(bookRecords)
    .where(and(eq(bookRecords.userId, userId), eq(bookRecords.habitId, habitId)))
    .orderBy(desc(bookRecords.createdAt));
}

export async function getActiveBook(userId: number, habitId: number) {
  const db = await getDb();
  if (!db) return null;
  const rows = await db
    .select()
    .from(bookRecords)
    .where(and(eq(bookRecords.userId, userId), eq(bookRecords.habitId, habitId), eq(bookRecords.isCompleted, false)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createBookRecord(
  userId: number,
  habitId: number,
  data: { title: string; totalPages: number; startedAt?: string }
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [result] = await db.insert(bookRecords).values({ userId, habitId, ...data }).returning({ insertId: bookRecords.id });
  return result.insertId as number;
}

export async function updateBookPagesRead(userId: number, bookId: number, pagesRead: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const rows = await db.select().from(bookRecords).where(and(eq(bookRecords.id, bookId), eq(bookRecords.userId, userId))).limit(1);
  if (!rows[0]) throw new Error("Book not found");
  const book = rows[0];
  const isCompleted = pagesRead >= book.totalPages;
  await db
    .update(bookRecords)
    .set({ pagesRead, isCompleted, completedAt: isCompleted ? toBangkokDateStr() : undefined })
    .where(and(eq(bookRecords.id, bookId), eq(bookRecords.userId, userId)));
  return { isCompleted, totalPages: book.totalPages };
}

export async function addReadingLog(
  userId: number,
  bookId: number,
  logDate: string,
  pagesReadToday: number,
  notes?: string
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  await db.insert(readingLogs).values({ userId, bookId, logDate, pagesReadToday, notes });
}

// ─── Scoring Engine ───────────────────────────────────────────────────────────
/**
 * Calculate weekly score for a frequency habit.
 * Score = (actual completions / target) * 100, capped at 100.
 * Rest days (days with no target) are not penalised.
 */
export function calcFrequencyWeekScore(completions: number, weeklyTarget: number): number {
  if (weeklyTarget <= 0) return 100;
  return Math.min(100, Math.round((completions / weeklyTarget) * 100));
}

/**
 * Calculate score for a time-limit habit (sleep/wake).
 * isBeforeLimit=true: score 100 if loggedTime <= timeLimit, else 0.
 * isBeforeLimit=false: score 100 if loggedTime >= timeLimit, else 0.
 */
export function calcTimeLimitDayScore(loggedTime: string | null, timeLimit: string, isBeforeLimit: boolean): number {
  if (!loggedTime) return 0;
  const toMinutes = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + m;
  };
  const logged = toMinutes(loggedTime);
  const limit = toMinutes(timeLimit);
  if (isBeforeLimit) return logged <= limit ? 100 : 0;
  return logged >= limit ? 100 : 0;
}

/**
 * Calculate monthly score for a habit.
 * For frequency habits: average weekly score across all weeks in month.
 * For time_limit habits: percentage of days with score=100.
 * For book habits: (pagesRead / monthlyTarget) * 100.
 */
export interface HabitMonthScore {
  habitId: number;
  score: number; // 0-100
  details: {
    weeklyScores?: number[];
    daysHit?: number;
    totalDays?: number;
    pagesRead?: number;
    monthlyTarget?: number;
  };
}

export function calcHabitMonthScore(
  habit: { id: number; type: string; weeklyTarget: number | null; monthlyTarget?: number | null; timeLimit: string | null; isBeforeLimit: boolean | null },
  logs: { logDate: string; completed: boolean; loggedTime?: string | null }[],
  year: number,
  month: number,
  bookData?: { pagesRead: number; monthlyTarget: number }
): HabitMonthScore {
  if (habit.type === "book") {
    if (!bookData) return { habitId: habit.id, score: 0, details: {} };
    const score = Math.min(100, Math.round((bookData.pagesRead / bookData.monthlyTarget) * 100));
    return { habitId: habit.id, score, details: { pagesRead: bookData.pagesRead, monthlyTarget: bookData.monthlyTarget } };
  }

  if (habit.type === "monthly_frequency") {
    const completions = logs.filter((l) => l.completed).length;
    const target = habit.monthlyTarget ?? 4;
    const score = Math.min(100, Math.round((completions / target) * 100));
    return { habitId: habit.id, score, details: { daysHit: completions, monthlyTarget: target } };
  }

  if (habit.type === "time_limit") {
    const daysInMonth = new Date(year, month, 0).getDate();
    let daysHit = 0;
    for (const log of logs) {
      if (log.loggedTime && habit.timeLimit) {
        const dayScore = calcTimeLimitDayScore(log.loggedTime, habit.timeLimit, habit.isBeforeLimit ?? true);
        if (dayScore === 100) daysHit++;
      }
    }
    const score = Math.round((daysHit / daysInMonth) * 100);
    return { habitId: habit.id, score, details: { daysHit, totalDays: daysInMonth } };
  }

  // frequency habit — calculate per-week
  const weeklyScores: number[] = [];
  const { start, end } = getBangkokMonthRange(year, month);
  const startDate = new Date(start + "T00:00:00+07:00");
  const endDate = new Date(end + "T23:59:59+07:00");

  // Group by ISO week (Mon-Sun)
  const weekMap = new Map<string, number>();
  for (const log of logs) {
    if (!log.completed) continue;
    const d = new Date(log.logDate + "T12:00:00+07:00");
    const dayOfWeek = (d.getDay() + 6) % 7; // 0=Mon
    const monday = new Date(d);
    monday.setDate(d.getDate() - dayOfWeek);
    const weekKey = monday.toISOString().split("T")[0];
    weekMap.set(weekKey, (weekMap.get(weekKey) ?? 0) + 1);
  }

  // Enumerate weeks that overlap with the month
  const seen = new Set<string>();
  const cur = new Date(startDate);
  while (cur <= endDate) {
    const dayOfWeek = (cur.getDay() + 6) % 7;
    const monday = new Date(cur);
    monday.setDate(cur.getDate() - dayOfWeek);
    const weekKey = monday.toISOString().split("T")[0];
    if (!seen.has(weekKey)) {
      seen.add(weekKey);
      const completions = weekMap.get(weekKey) ?? 0;
      weeklyScores.push(calcFrequencyWeekScore(completions, habit.weeklyTarget ?? 3));
    }
    cur.setDate(cur.getDate() + 1);
  }

  const score = weeklyScores.length > 0 ? Math.round(weeklyScores.reduce((a, b) => a + b, 0) / weeklyScores.length) : 0;
  return { habitId: habit.id, score, details: { weeklyScores } };
}

/**
 * Calculate overall monthly score from individual habit scores.
 * Weighted average using scoreWeight, normalised to 100.
 */
export function calcOverallMonthScore(
  habits: { id: number; scoreWeight: number | null }[],
  habitScores: HabitMonthScore[]
): number {
  const scoreMap = new Map(habitScores.map((s) => [s.habitId, s.score]));
  const totalWeight = habits.reduce((sum, h) => sum + (h.scoreWeight ?? 20), 0);
  if (totalWeight === 0) return 0;
  const weighted = habits.reduce((sum, h) => {
    const score = scoreMap.get(h.id) ?? 0;
    return sum + score * (h.scoreWeight ?? 20);
  }, 0);
  return Math.round(weighted / totalWeight);
}
