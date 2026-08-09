import { z } from "zod";
import { router, protectedProcedure } from "../_core/trpc";
import { timeTrackerCategories, timeTrackerLogs } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";
import { getDb } from "../db";
import { format } from "date-fns";

export const timeTrackerRouter = router({
  getCategories: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    let categories = await db
      .select()
      .from(timeTrackerCategories)
      .where(eq(timeTrackerCategories.userId, ctx.user.id))
      .orderBy(timeTrackerCategories.sortOrder);
      
    // Seed default categories if none exist
    if (categories.length === 0) {
      const defaults = [
        { userId: ctx.user.id, name: "ทำงาน", icon: "briefcase", color: "#3b82f6", goalMinutesPerDay: 5 * 60, sortOrder: 1 },
        { userId: ctx.user.id, name: "ออกกำลังกาย", icon: "activity", color: "#10b981", goalMinutesPerDay: 60, sortOrder: 2 },
        { userId: ctx.user.id, name: "เรียนการลงทุน", icon: "trending-up", color: "#f59e0b", goalMinutesPerDay: 2 * 60, sortOrder: 3 },
        { userId: ctx.user.id, name: "เรียน/ทำ AI", icon: "cpu", color: "#8b5cf6", goalMinutesPerDay: 2 * 60, sortOrder: 4 },
      ];
      await db.insert(timeTrackerCategories).values(defaults);
      categories = await db
        .select()
        .from(timeTrackerCategories)
        .where(eq(timeTrackerCategories.userId, ctx.user.id))
        .orderBy(timeTrackerCategories.sortOrder);
    }
    return categories;
  }),

  getTodayLogs: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const today = format(new Date(), "yyyy-MM-dd");
    return db
      .select()
      .from(timeTrackerLogs)
      .where(
        and(
          eq(timeTrackerLogs.userId, ctx.user.id),
          eq(timeTrackerLogs.logDate, today)
        )
      );
  }),

  logTime: protectedProcedure
    .input(z.object({
      categoryId: z.number(),
      durationSeconds: z.number(),
      date: z.string().optional() // defaults to today if not provided
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      const logDate = input.date || format(new Date(), "yyyy-MM-dd");
      
      const existing = await db
        .select()
        .from(timeTrackerLogs)
        .where(
          and(
            eq(timeTrackerLogs.userId, ctx.user.id),
            eq(timeTrackerLogs.categoryId, input.categoryId),
            eq(timeTrackerLogs.logDate, logDate)
          )
        )
        .limit(1);

      if (existing.length > 0) {
        return db
          .update(timeTrackerLogs)
          .set({ 
            durationSeconds: existing[0].durationSeconds + input.durationSeconds,
            updatedAt: sql`(strftime('%s', 'now'))`
          })
          .where(eq(timeTrackerLogs.id, existing[0].id));
      } else {
        return db
          .insert(timeTrackerLogs)
          .values({
            userId: ctx.user.id,
            categoryId: input.categoryId,
            logDate: logDate,
            durationSeconds: input.durationSeconds
          });
      }
    }),

  getAllTimeStats: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    const stats = await db
      .select({
        categoryId: timeTrackerLogs.categoryId,
        totalSeconds: sql<number>`SUM(${timeTrackerLogs.durationSeconds})`
      })
      .from(timeTrackerLogs)
      .where(eq(timeTrackerLogs.userId, ctx.user.id))
      .groupBy(timeTrackerLogs.categoryId);
      
    // Fetch last 30 days of data for the trend chart
    const thirtyDaysAgo = format(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), "yyyy-MM-dd");
    const trend = await db
      .select({
        logDate: timeTrackerLogs.logDate,
        categoryId: timeTrackerLogs.categoryId,
        durationSeconds: timeTrackerLogs.durationSeconds
      })
      .from(timeTrackerLogs)
      .where(
        and(
          eq(timeTrackerLogs.userId, ctx.user.id),
          sql`${timeTrackerLogs.logDate} >= ${thirtyDaysAgo}`
        )
      );
      
    return { allTime: stats, trend };
  }),
});
