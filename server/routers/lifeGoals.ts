import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { bucketItems, yearlyGoals } from "../../drizzle/schema";
import { eq, and, asc } from "drizzle-orm";
import { generateImage } from "../_core/imageGeneration";
import { invokeLLM } from "../_core/llm";

// ─── Bucket List helpers ──────────────────────────────────────────────────────
async function getBucketItems(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  return db.select().from(bucketItems)
    .where(eq(bucketItems.userId, userId))
    .orderBy(asc(bucketItems.sortOrder), asc(bucketItems.id));
}

// ─── Yearly Goals helpers ─────────────────────────────────────────────────────
async function getYearlyGoal(userId: number, year: number) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const [row] = await db.select().from(yearlyGoals)
    .where(and(eq(yearlyGoals.userId, userId), eq(yearlyGoals.year, year)));
  if (!row) return null;
  return {
    ...row,
    goals: JSON.parse(row.goals) as Array<{ id: string; text: string; isDone: boolean }>,
  };
}

async function upsertYearlyGoal(
  userId: number,
  year: number,
  goals: Array<{ id: string; text: string; isDone: boolean }>,
  bgImageUrl?: string | null,
  bgPrompt?: string | null
) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");
  const existing = await getYearlyGoal(userId, year);
  const goalsJson = JSON.stringify(goals);
  if (existing) {
    await db.update(yearlyGoals)
      .set({
        goals: goalsJson,
        ...(bgImageUrl !== undefined ? { bgImageUrl } : {}),
        ...(bgPrompt !== undefined ? { bgPrompt } : {}),
      })
      .where(and(eq(yearlyGoals.userId, userId), eq(yearlyGoals.year, year)));
  } else {
    await db.insert(yearlyGoals).values({
      userId, year, goals: goalsJson,
      bgImageUrl: bgImageUrl ?? null,
      bgPrompt: bgPrompt ?? null,
    });
  }
  return getYearlyGoal(userId, year);
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const lifeGoalsRouter = router({
  // ── Bucket List ──────────────────────────────────────────────────────────
  listBucket: protectedProcedure.query(({ ctx }) => getBucketItems(ctx.user.id)),

  addBucketItem: protectedProcedure
    .input(z.object({
      text: z.string().min(1).max(500),
      category: z.string().max(128).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const existing = await getBucketItems(ctx.user.id);
      const sortOrder = existing.length;
      const [result] = await db.insert(bucketItems).values({
        userId: ctx.user.id,
        text: input.text,
        category: input.category ?? "general",
        isDone: false,
        sortOrder,
      }).returning({ insertId: bucketItems.id });
      return { id: result.insertId };
    }),

  toggleBucketItem: protectedProcedure
    .input(z.object({ id: z.number(), isDone: z.boolean() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.update(bucketItems)
        .set({ isDone: input.isDone })
        .where(and(eq(bucketItems.id, input.id), eq(bucketItems.userId, ctx.user.id)));
    }),

  updateBucketItem: protectedProcedure
    .input(z.object({ id: z.number(), text: z.string().min(1).max(500).optional(), category: z.string().max(128).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      const { id, ...data } = input;
      await db.update(bucketItems).set(data).where(and(eq(bucketItems.id, id), eq(bucketItems.userId, ctx.user.id)));
    }),

  deleteBucketItem: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await db.delete(bucketItems).where(and(eq(bucketItems.id, input.id), eq(bucketItems.userId, ctx.user.id)));
    }),

  reorderBucket: protectedProcedure
    .input(z.object({ orderedIds: z.array(z.number()) }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB unavailable");
      await Promise.all(input.orderedIds.map((id, idx) =>
        db.update(bucketItems).set({ sortOrder: idx }).where(and(eq(bucketItems.id, id), eq(bucketItems.userId, ctx.user.id)))
      ));
    }),

  // ── Yearly Goals ─────────────────────────────────────────────────────────
  getYearlyGoal: protectedProcedure
    .input(z.object({ year: z.number().min(2020).max(2100) }))
    .query(({ ctx, input }) => getYearlyGoal(ctx.user.id, input.year)),

  saveYearlyGoal: protectedProcedure
    .input(z.object({
      year: z.number().min(2020).max(2100),
      goals: z.array(z.object({ id: z.string(), text: z.string(), isDone: z.boolean() })),
    }))
    .mutation(({ ctx, input }) => upsertYearlyGoal(ctx.user.id, input.year, input.goals)),

  generateBgImage: protectedProcedure
    .input(z.object({
      year: z.number().min(2020).max(2100),
      goals: z.array(z.string()),
    }))
    .mutation(async ({ ctx, input }) => {
      const goalList = input.goals.slice(0, 10).join(", ");
      
      let translatedGoals = goalList;
      try {
        const llmResult = await invokeLLM({
          messages: [{
            role: "user",
            content: `You are an expert AI image prompt engineer. The user has the following life goals for the year: "${goalList}". Create a highly descriptive, cohesive image generation prompt in English that represents the successful achievement of these goals. Describe a beautiful, inspiring, unified scene or a cinematic dreamscape that integrates these themes naturally. CRITICAL: You MUST explicitly preserve any specific brands, models (e.g., Audi TTS), colors (e.g., black), and locations mentioned in the goals. Do not change the car model or color. Do not use words like 'collage' or 'split screen'. Reply ONLY with the prompt text, no intro or outro.`
          }],
          maxTokens: 200,
        });
        if (llmResult.choices[0]?.message?.content) {
          const content = llmResult.choices[0].message.content;
          if (typeof content === 'string') {
            translatedGoals = content.trim();
          } else if (Array.isArray(content)) {
            translatedGoals = content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join(' ')
              .trim();
          }
        }
      } catch (err) {
        console.error("LLM translation failed, falling back to original goals:", err);
      }

      const prompt = `${translatedGoals}, photorealistic, 8k resolution, cinematic lighting, vibrant, motivational and uplifting atmosphere, masterpiece, visually stunning.`;
      console.log("[ImageGen] Final prompt:", prompt);

      const { url } = await generateImage({ prompt, quality: "medium" });
      if (!url) throw new Error("Image generation failed");

      // Save to DB
      const existing = await getYearlyGoal(ctx.user.id, input.year);
      const goals = existing?.goals ?? input.goals.map((t, i) => ({ id: String(i), text: t, isDone: false }));
      await upsertYearlyGoal(ctx.user.id, input.year, goals, url, prompt);

      return { url };
    }),
});
