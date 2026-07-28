import { z } from "zod";
import { eq, desc, and } from "drizzle-orm";
import { getDb } from "../db";
import { bookSummaries, bookPreferences } from "../../drizzle/schema";
import { protectedProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { TRPCError } from "@trpc/server";

// ─── Genre Config ─────────────────────────────────────────────────────────────
const GENRE_CONFIG: Record<string, { label: string; emoji: string; color: string }> = {
  business: { label: "การทำธุรกิจ", emoji: "💼", color: "#6366f1" },
  finance: { label: "การเงิน", emoji: "💰", color: "#10b981" },
  marketing: { label: "การตลาด", emoji: "📣", color: "#f59e0b" },
  psychology: { label: "จิตวิทยา", emoji: "🧠", color: "#8b5cf6" },
  philosophy: { label: "ปรัชญาชีวิต", emoji: "🌿", color: "#06b6d4" },
  religion: { label: "ศาสนา", emoji: "🙏", color: "#ec4899" },
  management: { label: "การบริหารคน", emoji: "👥", color: "#f97316" },
};

// ─── Weighted random genre picker ────────────────────────────────────────────
type PrefWeights = {
  businessWeight: number;
  financeWeight: number;
  marketingWeight: number;
  psychologyWeight: number;
  philosophyWeight: number;
  religionWeight: number;
  managementWeight: number;
};

function pickGenre(prefs: PrefWeights): string {
  const weights: Record<string, number> = {
    business: prefs.businessWeight,
    finance: prefs.financeWeight,
    marketing: prefs.marketingWeight,
    psychology: prefs.psychologyWeight,
    philosophy: prefs.philosophyWeight,
    religion: prefs.religionWeight,
    management: prefs.managementWeight,
  };
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let rand = Math.random() * total;
  for (const [genre, w] of Object.entries(weights)) {
    rand -= w;
    if (rand <= 0) return genre;
  }
  return "business";
}

// ─── Week label helper (Bangkok UTC+7) ──────────────────────────────────────
function getWeekLabel(date: Date = new Date()): string {
  // Return ISO week string e.g. "2026-W29"
  const bkk = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const jan1 = new Date(bkk.getFullYear(), 0, 1);
  const week = Math.ceil(((bkk.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${bkk.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ─── AI Book Pool ─────────────────────────────────────────────────────────────
const BOOK_POOL: Record<string, Array<{ title: string; author: string }>> = {
  business: [
    { title: "Zero to One", author: "Peter Thiel" },
    { title: "The Lean Startup", author: "Eric Ries" },
    { title: "Good to Great", author: "Jim Collins" },
    { title: "Built to Last", author: "Jim Collins" },
    { title: "The E-Myth Revisited", author: "Michael E. Gerber" },
    { title: "Shoe Dog", author: "Phil Knight" },
    { title: "The Hard Thing About Hard Things", author: "Ben Horowitz" },
    { title: "Rework", author: "Jason Fried" },
    { title: "Blitzscaling", author: "Reid Hoffman" },
    { title: "The Innovator's Dilemma", author: "Clayton Christensen" },
  ],
  finance: [
    { title: "Rich Dad Poor Dad", author: "Robert Kiyosaki" },
    { title: "The Intelligent Investor", author: "Benjamin Graham" },
    { title: "Think and Grow Rich", author: "Napoleon Hill" },
    { title: "The Millionaire Next Door", author: "Thomas Stanley" },
    { title: "I Will Teach You to Be Rich", author: "Ramit Sethi" },
    { title: "The Psychology of Money", author: "Morgan Housel" },
    { title: "A Random Walk Down Wall Street", author: "Burton Malkiel" },
    { title: "One Up On Wall Street", author: "Peter Lynch" },
    { title: "The Little Book of Common Sense Investing", author: "John Bogle" },
    { title: "Your Money or Your Life", author: "Vicki Robin" },
  ],
  marketing: [
    { title: "Influence", author: "Robert Cialdini" },
    { title: "Contagious", author: "Jonah Berger" },
    { title: "Purple Cow", author: "Seth Godin" },
    { title: "Building a StoryBrand", author: "Donald Miller" },
    { title: "Positioning", author: "Al Ries & Jack Trout" },
    { title: "Hooked", author: "Nir Eyal" },
    { title: "Traction", author: "Gabriel Weinberg" },
    { title: "Crossing the Chasm", author: "Geoffrey Moore" },
    { title: "$100M Offers", author: "Alex Hormozi" },
    { title: "This Is Marketing", author: "Seth Godin" },
  ],
  psychology: [
    { title: "Thinking, Fast and Slow", author: "Daniel Kahneman" },
    { title: "Man's Search for Meaning", author: "Viktor Frankl" },
    { title: "The Power of Habit", author: "Charles Duhigg" },
    { title: "Mindset", author: "Carol Dweck" },
    { title: "Atomic Habits", author: "James Clear" },
    { title: "Flow", author: "Mihaly Csikszentmihalyi" },
    { title: "Emotional Intelligence", author: "Daniel Goleman" },
    { title: "The Subtle Art of Not Giving a F*ck", author: "Mark Manson" },
    { title: "Blink", author: "Malcolm Gladwell" },
    { title: "Predictably Irrational", author: "Dan Ariely" },
  ],
  philosophy: [
    { title: "Meditations", author: "Marcus Aurelius" },
    { title: "The Alchemist", author: "Paulo Coelho" },
    { title: "Sapiens", author: "Yuval Noah Harari" },
    { title: "The 4-Hour Workweek", author: "Tim Ferriss" },
    { title: "Essentialism", author: "Greg McKeown" },
    { title: "The Obstacle Is the Way", author: "Ryan Holiday" },
    { title: "Ego Is the Enemy", author: "Ryan Holiday" },
    { title: "The Power of Now", author: "Eckhart Tolle" },
    { title: "Ikigai", author: "Héctor García" },
    { title: "12 Rules for Life", author: "Jordan Peterson" },
  ],
  religion: [
    { title: "Mere Christianity", author: "C.S. Lewis" },
    { title: "The Purpose Driven Life", author: "Rick Warren" },
    { title: "Siddhartha", author: "Hermann Hesse" },
    { title: "The Art of Happiness", author: "Dalai Lama" },
    { title: "When Breath Becomes Air", author: "Paul Kalanithi" },
    { title: "The Road Less Traveled", author: "M. Scott Peck" },
    { title: "The Dhammapada", author: "Translated by Buddharakkhita" },
    { title: "Tao Te Ching", author: "Laozi" },
    { title: "Man's Search for Meaning", author: "Viktor Frankl" },
    { title: "The Book of Joy", author: "Dalai Lama & Desmond Tutu" },
  ],
  management: [
    { title: "The 7 Habits of Highly Effective People", author: "Stephen Covey" },
    { title: "Leaders Eat Last", author: "Simon Sinek" },
    { title: "Start with Why", author: "Simon Sinek" },
    { title: "Measure What Matters", author: "John Doerr" },
    { title: "High Output Management", author: "Andy Grove" },
    { title: "The Five Dysfunctions of a Team", author: "Patrick Lencioni" },
    { title: "Drive", author: "Daniel Pink" },
    { title: "Radical Candor", author: "Kim Scott" },
    { title: "The One Minute Manager", author: "Ken Blanchard" },
    { title: "First, Break All the Rules", author: "Marcus Buckingham" },
  ],
};

// ─── Extract text from LLM result ────────────────────────────────────────────
function extractText(result: Awaited<ReturnType<typeof invokeLLM>>): string {
  const choice = result.choices?.[0];
  if (!choice) return "";
  const content = choice.message?.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((p): p is { type: "text"; text: string } => p.type === "text")
      .map((p) => p.text)
      .join("");
  }
  return "";
}

// ─── Generate book summary via AI ────────────────────────────────────────────
export async function generateBookSummary(userId: number, genre: string, dateLabel: string) {
  const db = await getDb();
  if (!db) throw new Error("DB unavailable");

  const existing = await db.select({ title: bookSummaries.title })
    .from(bookSummaries)
    .where(eq(bookSummaries.userId, userId));
  const readTitles = new Set(existing.map((b: { title: string }) => b.title));

  const pool = BOOK_POOL[genre] ?? BOOK_POOL.business;
  const available = pool.filter((b) => !readTitles.has(b.title));
  const book = available.length > 0
    ? available[Math.floor(Math.random() * available.length)]
    : pool[Math.floor(Math.random() * pool.length)];

  const genreLabel = GENRE_CONFIG[genre]?.label ?? genre;

  const prompt = `คุณคือผู้เชี่ยวชาญด้านการสรุปหนังสือ ให้สรุปหนังสือ "${book.title}" โดย ${book.author} (แนว: ${genreLabel}) เป็นภาษาไทยที่อ่านง่าย เข้าใจง่าย สไตล์สนทนา

กรุณาสรุปในรูปแบบต่อไปนี้ (ความยาวเทียบเท่า 100-150 หน้า):

## 📖 ภาพรวมหนังสือ
[สรุปภาพรวม 3-4 ย่อหน้า ว่าหนังสือเล่มนี้เกี่ยวกับอะไร ทำไมถึงสำคัญ]

## 🎯 ใจความสำคัญ (5-7 บท)
[แบ่งเป็นบทๆ แต่ละบทมีหัวข้อ + อธิบาย 3-5 ย่อหน้า พร้อมตัวอย่างและเรื่องราวจากหนังสือ]

## 💡 บทเรียนที่นำไปใช้ได้จริง
[5-8 ข้อ แต่ละข้ออธิบายวิธีนำไปใช้ในชีวิตจริงหรือธุรกิจ]

## 🔑 คำคมและแนวคิดสำคัญ
[5-7 คำคมหรือแนวคิดเด่นจากหนังสือ พร้อมอธิบายความหมาย]

## 📊 สรุปสุดท้าย
[สรุป 2-3 ย่อหน้า ว่าใครควรอ่านหนังสือเล่มนี้ และจะได้อะไรจากมัน]

เขียนให้ละเอียด ลึกซึ้ง เหมือนอ่านหนังสือจริงๆ ไม่ใช่แค่สรุปสั้นๆ`;

  let result;
  let lessonsResult;
  try {
    result = await invokeLLM({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      maxTokens: 8000,
    });

    const summaryText = extractText(result);

    // Extract key lessons as JSON
    const lessonsPrompt = `จากหนังสือ "${book.title}" สรุปบทเรียนสำคัญ 6 ข้อ เป็น JSON array ภาษาไทย format: ["บทเรียน 1", "บทเรียน 2", ...] ตอบแค่ JSON เท่านั้น ไม่ต้องมีข้อความอื่น`;
    lessonsResult = await invokeLLM({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: lessonsPrompt }],
      maxTokens: 500,
    });
  } catch (e: any) {
    if (e.message?.includes("429") || e.message?.includes("RESOURCE_EXHAUSTED") || e.message?.includes("quota")) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "โควต้า AI เต็มชั่วคราวครับ 😅 รบกวนรอประมาณ 30-60 วินาที แล้วลองกดสร้างใหม่อีกครั้งนะครับ",
      });
    }
    throw e;
  }

  let keyLessons = "[]";
  try {
    const raw = extractText(lessonsResult!);
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) {
      JSON.parse(match[0]);
      keyLessons = match[0];
    }
  } catch {
    keyLessons = JSON.stringify([`อ่าน ${book.title} เพื่อเรียนรู้เพิ่มเติม`]);
  }

  const cfg = GENRE_CONFIG[genre] ?? GENRE_CONFIG.business;
  await db.insert(bookSummaries).values({
    userId,
    title: book.title,
    author: book.author,
    genre,
    coverEmoji: cfg.emoji,
    coverColor: cfg.color,
    summary: extractText(result!),
    keyLessons,
    weekLabel: dateLabel,
    isRead: false,
  });
}

// ─── Router ───────────────────────────────────────────────────────────────────
export const bookSummariesRouter = router({
  list: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return [];
    return db.select().from(bookSummaries)
      .where(eq(bookSummaries.userId, ctx.user.id))
      .orderBy(desc(bookSummaries.createdAt));
  }),

  current: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const weekLabel = getWeekLabel();
    const rows = await db.select().from(bookSummaries)
      .where(and(
        eq(bookSummaries.userId, ctx.user.id),
        eq(bookSummaries.weekLabel, weekLabel),
      ))
      .limit(1);
    return rows[0] ?? null;
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.update(bookSummaries)
        .set({ isRead: true, readAt: new Date() })
        .where(and(
          eq(bookSummaries.id, input.id),
          eq(bookSummaries.userId, ctx.user.id),
        ));
      return { ok: true };
    }),

  generateNow: protectedProcedure.mutation(async ({ ctx }) => {
    const db = await getDb();
    if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
    const weekLabel = getWeekLabel();
    const existing = await db.select({ id: bookSummaries.id })
      .from(bookSummaries)
      .where(and(
        eq(bookSummaries.userId, ctx.user.id),
        eq(bookSummaries.weekLabel, weekLabel),
      ))
      .limit(1);

    if (existing.length > 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "มีหนังสือสัปดาห์นี้แล้ว กดรีเฟรชเพื่อดู" });
    }

    const prefRows = await db.select().from(bookPreferences)
      .where(eq(bookPreferences.userId, ctx.user.id))
      .limit(1);
    const prefs: PrefWeights = prefRows[0] ?? {
      businessWeight: 100, financeWeight: 100, marketingWeight: 80,
      psychologyWeight: 70, philosophyWeight: 50, religionWeight: 50, managementWeight: 70,
    };

    const genre = pickGenre(prefs);
    await generateBookSummary(ctx.user.id, genre, weekLabel);
    return { ok: true };
  }),

  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const db = await getDb();
    if (!db) return null;
    const rows = await db.select().from(bookPreferences)
      .where(eq(bookPreferences.userId, ctx.user.id))
      .limit(1);
    return rows[0] ?? null;
  }),

  savePreferences: protectedProcedure
    .input(z.object({
      businessWeight: z.number().min(0).max(100),
      financeWeight: z.number().min(0).max(100),
      marketingWeight: z.number().min(0).max(100),
      psychologyWeight: z.number().min(0).max(100),
      philosophyWeight: z.number().min(0).max(100),
      religionWeight: z.number().min(0).max(100),
      managementWeight: z.number().min(0).max(100),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      const existing = await db.select({ id: bookPreferences.id })
        .from(bookPreferences)
        .where(eq(bookPreferences.userId, ctx.user.id))
        .limit(1);

      if (existing.length > 0) {
        await db.update(bookPreferences)
          .set(input)
          .where(eq(bookPreferences.userId, ctx.user.id));
      } else {
        await db.insert(bookPreferences).values({ userId: ctx.user.id, ...input });
      }
      return { ok: true };
    }),

  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "DB unavailable" });
      await db.delete(bookSummaries)
        .where(and(
          eq(bookSummaries.id, input.id),
          eq(bookSummaries.userId, ctx.user.id),
        ));
      return { ok: true };
    }),
});
