import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bookRecords as bookRecordsTable, readingLogs as readingLogsTable } from "../../drizzle/schema";
import {
  getHabits, createHabit, updateHabit, deleteHabit,
  getHabitLogsForMonth, getHabitLogsForDate, upsertHabitLog,
  getBookRecords, getActiveBook, createBookRecord, updateBookPagesRead, addReadingLog,
  calcHabitMonthScore, calcOverallMonthScore, toBangkokDateStr, getBangkokMonthRange,
} from "../habitDb";

export const habitsRouter = router({
  // List all active habits for the user
  list: protectedProcedure.query(({ ctx }) => getHabits(ctx.user.id)),

  // Create a new habit
  create: protectedProcedure
    .input(z.object({
      name: z.string().min(1).max(255),
      icon: z.string().optional(),
      color: z.string().optional(),
      type: z.enum(["frequency", "time_limit", "book", "monthly_frequency"]),
      weeklyTarget: z.number().min(1).max(7).optional(),
      monthlyTarget: z.number().min(1).max(365).optional(),
      timeLimit: z.string().optional(),
      isBeforeLimit: z.boolean().optional(),
      scoreWeight: z.number().min(0).max(100).optional(),
    }))
    .mutation(({ ctx, input }) => createHabit(ctx.user.id, input)),

  // Update a habit
  update: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().min(1).max(255).optional(),
      icon: z.string().optional(),
      color: z.string().optional(),
      weeklyTarget: z.number().min(1).max(7).optional(),
      monthlyTarget: z.number().min(1).max(365).optional(),
      timeLimit: z.string().optional(),
      isBeforeLimit: z.boolean().optional(),
      scoreWeight: z.number().min(0).max(100).optional(),
      isActive: z.boolean().optional(),
      isArchived: z.boolean().optional(),
      sortOrder: z.number().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return updateHabit(ctx.user.id, id, data);
    }),

  // Archive (soft-delete) a habit
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(({ ctx, input }) => deleteHabit(ctx.user.id, input.id)),

  // Get logs for a month
  logsForMonth: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .query(({ ctx, input }) => getHabitLogsForMonth(ctx.user.id, input.year, input.month)),

  // Get logs for a specific date
  logsForDate: protectedProcedure
    .input(z.object({ date: z.string() }))
    .query(({ ctx, input }) => getHabitLogsForDate(ctx.user.id, input.date)),

  // Upsert a habit log (check-in)
  checkin: protectedProcedure
    .input(z.object({
      habitId: z.number(),
      logDate: z.string(),
      completed: z.boolean(),
      activityType: z.string().optional(),
      durationMinutes: z.number().optional(),
      topic: z.string().optional(),
      notes: z.string().optional(),
      loggedTime: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { habitId, logDate, ...data } = input;
      return upsertHabitLog(ctx.user.id, habitId, logDate, data);
    }),

  // Monthly score calculation
  monthScore: protectedProcedure
    .input(z.object({ year: z.number(), month: z.number().min(1).max(12) }))
    .query(async ({ ctx, input }) => {
      const { year, month } = input;
      const userHabits = await getHabits(ctx.user.id);
      const logs = await getHabitLogsForMonth(ctx.user.id, year, month);

      const habitScores = await Promise.all(
        userHabits.map(async (h) => {
          const habitLogs = logs.filter((l) => l.habitId === h.id);
          let bookData: { pagesRead: number; monthlyTarget: number } | undefined;
          if (h.type === "book") {
            const book = await getActiveBook(ctx.user.id, h.id);
            if (book) {
              const daysInMonth = new Date(year, month, 0).getDate();
              const monthlyTarget = Math.round((book.totalPages / 4) * (daysInMonth / 7));
              bookData = { pagesRead: book.pagesRead, monthlyTarget };
            }
          }
          return calcHabitMonthScore(h, habitLogs, year, month, bookData);
        })
      );

      const overall = calcOverallMonthScore(userHabits, habitScores);
      return { overall, habitScores, habits: userHabits };
    }),

  // Book records
  books: protectedProcedure
    .input(z.object({ habitId: z.number() }))
    .query(({ ctx, input }) => getBookRecords(ctx.user.id, input.habitId)),

  activeBook: protectedProcedure
    .input(z.object({ habitId: z.number() }))
    .query(({ ctx, input }) => getActiveBook(ctx.user.id, input.habitId)),

  createBook: protectedProcedure
    .input(z.object({
      habitId: z.number(),
      title: z.string().min(1).max(500),
      totalPages: z.number().min(1),
      startedAt: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => {
      const { habitId, ...data } = input;
      return createBookRecord(ctx.user.id, habitId, data);
    }),

  updateBookPages: protectedProcedure
    .input(z.object({ bookId: z.number(), pagesRead: z.number().min(0) }))
    .mutation(({ ctx, input }) => updateBookPagesRead(ctx.user.id, input.bookId, input.pagesRead)),

  addReadingLog: protectedProcedure
    .input(z.object({
      bookId: z.number(),
      logDate: z.string(),
      pagesReadToday: z.number().min(1),
      notes: z.string().optional(),
    }))
    .mutation(({ ctx, input }) => addReadingLog(ctx.user.id, input.bookId, input.logDate, input.pagesReadToday, input.notes)),

  // Seed demo data for current month
  seedDemo: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");

    const existing = await getHabits(userId);
    if (existing.length > 0) return { seeded: false, message: "Habits already exist" };

    const today = new Date();
    const year = parseInt(toBangkokDateStr(today).split("-")[0]);
    const month = parseInt(toBangkokDateStr(today).split("-")[1]);
    const { start } = getBangkokMonthRange(year, month);

    const exerciseId = await createHabit(userId, { name: "ออกกำลังกาย", icon: "dumbbell", color: "#22c55e", type: "frequency", weeklyTarget: 3, scoreWeight: 20 });
    const investId = await createHabit(userId, { name: "ศึกษาการลงทุน", icon: "trending-up", color: "#f59e0b", type: "frequency", weeklyTarget: 3, scoreWeight: 20 });
    const bookId = await createHabit(userId, { name: "อ่านหนังสือ", icon: "book-open", color: "#6366f1", type: "book", scoreWeight: 20 });
    const sleepId = await createHabit(userId, { name: "เข้านอนตรงเวลา", icon: "moon", color: "#8b5cf6", type: "time_limit", timeLimit: "23:00", isBeforeLimit: true, scoreWeight: 20 });
    const wakeId = await createHabit(userId, { name: "ตื่นตรงเวลา", icon: "sun", color: "#f97316", type: "time_limit", timeLimit: "07:00", isBeforeLimit: false, scoreWeight: 20 });

    const bookRecordId = await createBookRecord(userId, bookId, { title: "Atomic Habits", totalPages: 300, startedAt: start });

    const startDate = new Date(start + "T12:00:00+07:00");
    const todayStr = toBangkokDateStr(today);
    const cur = new Date(startDate);
    const exercises = ["วิ่ง", "ฟุตบอล", "ว่ายน้ำ", "ยิม", "โยคะ"];
    const topics = ["หุ้นไทย", "ETF", "DCA", "Crypto", "อสังหา"];
    let exerciseCount = 0, investCount = 0, totalPagesRead = 0, sleepHit = 0, wakeHit = 0;

    while (toBangkokDateStr(cur) <= todayStr) {
      const dateStr = toBangkokDateStr(cur);
      const dayOfWeek = cur.getDay();
      const dayOfMonth = cur.getDate();

      if ([1, 3, 5].includes(dayOfWeek) && Math.random() > 0.2) {
        await upsertHabitLog(userId, exerciseId, dateStr, { completed: true, activityType: exercises[dayOfMonth % exercises.length], durationMinutes: 45 + (dayOfMonth % 3) * 15 });
        exerciseCount++;
      }
      if ([2, 4, 6].includes(dayOfWeek) && Math.random() > 0.25) {
        await upsertHabitLog(userId, investId, dateStr, { completed: true, topic: topics[dayOfMonth % topics.length], durationMinutes: 30 });
        investCount++;
      }
      const pagesPerDay = 5 + (dayOfMonth % 8);
      if (Math.random() > 0.1) {
        totalPagesRead += pagesPerDay;
        await upsertHabitLog(userId, bookId, dateStr, { completed: true, durationMinutes: pagesPerDay * 2 });
        await addReadingLog(userId, bookRecordId, dateStr, pagesPerDay);
      }
      const sleepHour = dayOfMonth % 5 < 3 ? "22" : "23";
      const sleepMin = String(dayOfMonth % 60).padStart(2, "0");
      const sleepOk = sleepHour === "22" || (sleepHour === "23" && parseInt(sleepMin) <= 0);
      await upsertHabitLog(userId, sleepId, dateStr, { completed: sleepOk, loggedTime: `${sleepHour}:${sleepMin}` });
      if (sleepOk) sleepHit++;
      const wakeHour = dayOfMonth % 6 < 4 ? "06" : "07";
      const wakeMin = String((dayOfMonth * 3) % 60).padStart(2, "0");
      const wakeOk = wakeHour === "06";
      await upsertHabitLog(userId, wakeId, dateStr, { completed: wakeOk, loggedTime: `${wakeHour}:${wakeMin}` });
      if (wakeOk) wakeHit++;

      cur.setDate(cur.getDate() + 1);
    }

    await updateBookPagesRead(userId, bookRecordId, Math.min(totalPagesRead, 300));
    return { seeded: true, exerciseCount, investCount, totalPagesRead: Math.min(totalPagesRead, 300), sleepHit, wakeHit };
  }),

  // Reset demo data
  resetDemo: protectedProcedure.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = await getDb();
    if (!db) throw new Error("DB unavailable");
    const { eq: drizzleEq } = await import("drizzle-orm");
    const { habits: habitsTable, habitLogs: habitLogsTable } = await import("../../drizzle/schema");
    await db.delete(readingLogsTable).where(drizzleEq(readingLogsTable.userId, userId));
    await db.delete(bookRecordsTable).where(drizzleEq(bookRecordsTable.userId, userId));
    await db.delete(habitLogsTable).where(drizzleEq(habitLogsTable.userId, userId));
    await db.delete(habitsTable).where(drizzleEq(habitsTable.userId, userId));
    return { reset: true };
  }),
});
