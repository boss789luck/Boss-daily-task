/**
 * Weekly Book Summary Scheduler
 * Runs every Monday at 08:00 Bangkok time (01:00 UTC, cron: "0 1 * * 1")
 * Auto-generates a new book summary for all users who don't have one for this week.
 */

import { getDb } from "./db";
import { bookSummaries, bookPreferences } from "../drizzle/schema";
import { eq, and } from "drizzle-orm";
import { invokeLLM } from "./_core/llm";
import { sdk } from "./_core/sdk";

// ─── Week label helper (Bangkok UTC+7) ───────────────────────────────────────
function getWeekLabel(date: Date = new Date()): string {
  // Return ISO week string e.g. "2026-W29"
  const bkk = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const jan1 = new Date(bkk.getFullYear(), 0, 1);
  const week = Math.ceil(((bkk.getTime() - jan1.getTime()) / 86400000 + jan1.getDay() + 1) / 7);
  return `${bkk.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

// ─── Book pool ────────────────────────────────────────────────────────────────
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
    { title: "The Psychology of Money", author: "Morgan Housel" },
    { title: "I Will Teach You to Be Rich", author: "Ramit Sethi" },
    { title: "The Millionaire Next Door", author: "Thomas Stanley" },
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
    { title: "Hooked", author: "Nir Eyal" },
    { title: "Traction", author: "Gabriel Weinberg" },
    { title: "Crossing the Chasm", author: "Geoffrey Moore" },
    { title: "$100M Offers", author: "Alex Hormozi" },
    { title: "This Is Marketing", author: "Seth Godin" },
    { title: "Positioning", author: "Al Ries & Jack Trout" },
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
    { title: "The Road Less Traveled", author: "M. Scott Peck" },
    { title: "The Dhammapada", author: "Translated by Buddharakkhita" },
    { title: "Tao Te Ching", author: "Laozi" },
    { title: "The Book of Joy", author: "Dalai Lama & Desmond Tutu" },
    { title: "When Breath Becomes Air", author: "Paul Kalanithi" },
    { title: "Man's Search for Meaning", author: "Viktor Frankl" },
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

type PrefWeights = {
  businessWeight: number; financeWeight: number; marketingWeight: number;
  psychologyWeight: number; philosophyWeight: number; religionWeight: number; managementWeight: number;
};

function pickGenre(prefs: PrefWeights): string {
  const entries: Array<[string, number]> = [
    ["business", prefs.businessWeight],
    ["finance", prefs.financeWeight],
    ["marketing", prefs.marketingWeight],
    ["psychology", prefs.psychologyWeight],
    ["philosophy", prefs.philosophyWeight],
    ["religion", prefs.religionWeight],
    ["management", prefs.managementWeight],
  ];
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total === 0) return "business";
  let rand = Math.random() * total;
  for (const [genre, weight] of entries) {
    rand -= weight;
    if (rand <= 0) return genre;
  }
  return "business";
}

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

const COVER_EMOJIS: Record<string, string[]> = {
  business: ["💼", "🚀", "📊", "🏢", "⚡"],
  finance: ["💰", "📈", "💎", "🏦", "💵"],
  marketing: ["📣", "🎯", "✨", "🌟", "📱"],
  psychology: ["🧠", "💭", "🔮", "🌊", "🎭"],
  philosophy: ["🌍", "⚖️", "🔭", "🌿", "🦋"],
  religion: ["🙏", "☯️", "✝️", "🌙", "🕊️"],
  management: ["👥", "🎯", "🏆", "🤝", "📋"],
};

const COVER_COLORS: Record<string, string> = {
  business: "#1e3a5f",
  finance: "#1a4731",
  marketing: "#4a1942",
  psychology: "#2d1b69",
  philosophy: "#1a3a2a",
  religion: "#2d2d1a",
  management: "#1a2d4a",
};

async function generateBookSummaryForUser(userId: number, genre: string, weekLabel: string): Promise<void> {
  const pool = BOOK_POOL[genre] ?? BOOK_POOL.business;
  const book = pool[Math.floor(Math.random() * pool.length)];

  const summaryResult = await invokeLLM({
    model: "auto",
    messages: [
      {
        role: "system",
        content: `คุณเป็นนักสรุปหนังสือมืออาชีพ สรุปหนังสือเป็นภาษาไทยที่อ่านง่าย ชัดเจน และครอบคลุมเนื้อหาสำคัญทั้งหมด ใช้ภาษาที่เข้าใจง่าย ไม่เปลี่ยนแปลงเนื้อหาหลัก`,
      },
      {
        role: "user",
        content: `สรุปหนังสือ "${book.title}" โดย ${book.author} ให้ครบถ้วนและอ่านง่าย ความยาวประมาณ 100-150 หน้า (ประมาณ 6,000-8,000 คำ) แบ่งเป็นบทๆ ชัดเจน ใช้ภาษาไทยที่อ่านสนุก`,
      },
    ],
    max_tokens: 8000,
  });

  const summary = extractText(summaryResult);

  const lessonsResult = await invokeLLM({
    model: "auto",
    messages: [
      {
        role: "system",
        content: `คุณเป็นนักวิเคราะห์หนังสือ ดึงบทเรียนสำคัญออกมาเป็น JSON array`,
      },
      {
        role: "user",
        content: `จากหนังสือ "${book.title}" โดย ${book.author} ดึง 6 บทเรียนสำคัญที่สุดออกมา ตอบเป็น JSON array เท่านั้น ตัวอย่าง: ["บทเรียน 1", "บทเรียน 2", ...]`,
      },
    ],
    max_tokens: 500,
  });

  let keyLessons: string[] = [];
  try {
    const raw = extractText(lessonsResult);
    const match = raw.match(/\[[\s\S]*\]/);
    if (match) keyLessons = JSON.parse(match[0]);
  } catch {
    keyLessons = ["ไม่สามารถดึงบทเรียนได้"];
  }

  const emojis = COVER_EMOJIS[genre] ?? ["📚"];
  const coverEmoji = emojis[Math.floor(Math.random() * emojis.length)];
  const coverColor = COVER_COLORS[genre] ?? "#1a1a2e";

  const db = await getDb();
  if (!db) return;

  await db.insert(bookSummaries).values({
    userId,
    title: book.title,
    author: book.author,
    genre,
    coverEmoji,
    coverColor,
    summary,
    keyLessons: JSON.stringify(keyLessons),
    weekLabel,
    isRead: false,
  });
}

// ─── Scheduled handler (called by heartbeat every Monday 08:00 BKK) ──────────
export async function weeklyBookHandler(req: Request): Promise<Response> {
  try {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user?.isCron) {
      return Response.json({ error: "cron-only" }, { status: 403 });
    }

    const db = await getDb();
    if (!db) return Response.json({ error: "DB unavailable" }, { status: 500 });

    const weekLabel = getWeekLabel();

    // Get all distinct userIds who have used the book feature
    const prefUsers = await db.selectDistinct({ userId: bookPreferences.userId }).from(bookPreferences);
    const bookUsers = await db.selectDistinct({ userId: bookSummaries.userId }).from(bookSummaries);

    const seen = new Set<number>();
    const allUserIds: number[] = [];
    for (const r of prefUsers) { if (!seen.has(r.userId)) { seen.add(r.userId); allUserIds.push(r.userId); } }
    for (const r of bookUsers) { if (!seen.has(r.userId)) { seen.add(r.userId); allUserIds.push(r.userId); } }

    if (allUserIds.length === 0) {
      return Response.json({ ok: true, generated: 0, skipped: 0, message: "No active users" });
    }

    let generated = 0;
    let skipped = 0;

    for (const userId of allUserIds) {
      // Check if user already has a book for this week
      const weekBook = await db.select({ id: bookSummaries.id })
        .from(bookSummaries)
        .where(and(
          eq(bookSummaries.userId, userId),
          eq(bookSummaries.weekLabel, weekLabel),
        ))
        .limit(1);

      if (weekBook.length > 0) {
        skipped++;
        continue;
      }

      // Get user preferences
      const prefRows = await db.select().from(bookPreferences)
        .where(eq(bookPreferences.userId, userId))
        .limit(1);

      const prefs: PrefWeights = prefRows[0] ?? {
        businessWeight: 100, financeWeight: 100, marketingWeight: 80,
        psychologyWeight: 70, philosophyWeight: 50, religionWeight: 50, managementWeight: 70,
      };

      const genre = pickGenre(prefs);

      try {
        await generateBookSummaryForUser(userId, genre, weekLabel);
        generated++;
        console.log(`[WeeklyBook] Generated "${genre}" book for user ${userId} (${weekLabel})`);
      } catch (err) {
        console.error(`[WeeklyBook] Failed for user ${userId}:`, err);
      }
    }

    return Response.json({ ok: true, generated, skipped, weekLabel });
  } catch (err) {
    console.error("[WeeklyBook] Handler error:", err);
    return Response.json({ error: String(err) }, { status: 500 });
  }
}
