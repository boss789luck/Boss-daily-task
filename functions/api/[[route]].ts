import * as process from 'node:process';
(globalThis as any).process = process;

import { Hono } from 'hono'
import { handle } from 'hono/cloudflare-pages'
import { fetchRequestHandler } from '@trpc/server/adapters/fetch'
import { createContext } from '../../server/_core/context'
import { appRouter } from '../../server/routers'
import { sdk } from '../../server/_core/sdk'
import { dbStorage, getDb } from '../../server/db'
import { bucketStorage, storagePut, storageGet } from '../../server/storage'
import { yearlyGoals } from '../../drizzle/schema'
import { and, eq } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/d1'
import { googleAuthHandler, googleCallbackHandler, googleCleanupSyncHandler, gcalSyncHandler } from '../../server/googleCalendar'
import { weeklyBookHandler } from '../../server/weeklyBookScheduler'

const app = new Hono<{ Bindings: { DB: any; BUCKET: any } }>().basePath('/api')

// Middleware to inject D1 and R2 into AsyncLocalStorage
app.use('*', async (c, next) => {
  (globalThis as any).__ENV = c.env;
  const d1 = drizzle(c.env.DB);
  return bucketStorage.run(c.env.BUCKET, () => {
    return dbStorage.run(d1, async () => {
      await next()
    })
  })
})

// TRPC handler
app.all('/trpc/*', (c) => {
  return fetchRequestHandler({
    endpoint: '/api/trpc',
    req: c.req.raw,
    router: appRouter,
    createContext: (opts) => createContext({ ...opts, env: c.env }),
  })
})

// Vision Board: upload custom background image
app.post('/vision-board/upload', async (c) => {
  try {
    const user = await sdk.authenticateRequest(c.req.raw).catch(() => null);
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json().catch(() => ({}));
    const year = body.year;
    const imageBase64 = body.imageBase64;
    const mimeType = body.mimeType;

    // Validate inputs
    if (!year || typeof year !== "number" || year < 2020 || year > 2100) {
      return c.json({ error: "Invalid year" }, 400);
    }
    if (!imageBase64 || typeof imageBase64 !== "string") {
      return c.json({ error: "Missing image data" }, 400);
    }
    if (!mimeType || typeof mimeType !== "string") {
      return c.json({ error: "Missing mimeType" }, 400);
    }

    const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!allowedTypes.includes(mimeType)) {
      return c.json({ error: "Invalid image type. Allowed: jpeg, png, webp, gif" }, 400);
    }

    // Decode base64 and validate size
    const base64Data = imageBase64.replace(/^data:image\/[a-z]+;base64,/, "");
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const buffer = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      buffer[i] = binaryString.charCodeAt(i);
    }

    // Enforce 10MB max after decode
    const maxBytes = 10 * 1024 * 1024;
    if (buffer.length > maxBytes) {
      return c.json({ error: "Image too large (max 10MB)" }, 400);
    }

    // Basic magic-byte validation
    const magicBytes: Record<string, number[][]> = {
      "image/jpeg": [[0xFF, 0xD8, 0xFF]],
      "image/png": [[0x89, 0x50, 0x4E, 0x47]],
      "image/webp": [[0x52, 0x49, 0x46, 0x46]],
      "image/gif": [[0x47, 0x49, 0x46]],
    };
    const magic = magicBytes[mimeType];
    if (magic && !magic.some(sig => sig.every((b, i) => buffer[i] === b))) {
      return c.json({ error: "Image data does not match declared type" }, 400);
    }
    const ext = mimeType.split("/")[1] ?? "jpg";
    const { url } = await storagePut(`vision-board/${user.id}/${year}.${ext}`, buffer, mimeType);

    // Update DB
    const db = await getDb();
    if (!db) return c.json({ error: "DB unavailable" }, 500);

    const [existing] = await db.select().from(yearlyGoals)
      .where(and(eq(yearlyGoals.userId, user.id), eq(yearlyGoals.year, year)));

    if (existing) {
      await db.update(yearlyGoals)
        .set({ bgImageUrl: url, bgPrompt: null })
        .where(and(eq(yearlyGoals.userId, user.id), eq(yearlyGoals.year, year)));
    } else {
      await db.insert(yearlyGoals).values({
        userId: user.id,
        year,
        goals: "[]",
        bgImageUrl: url,
        bgPrompt: null,
      });
    }

    return c.json({ url });
  } catch (err) {
    console.error("[VisionBoard] upload error:", err);
    return c.json({ error: "Upload failed" }, 500);
  }
})

// Google Calendar routes
app.get('/google/auth', (c) => googleAuthHandler(c.req.raw))
app.get('/google/callback', (c) => googleCallbackHandler(c.req.raw))
app.post('/google/cleanup-sync', (c) => googleCleanupSyncHandler(c.req.raw))
app.post('/scheduled/gcal-sync', (c) => gcalSyncHandler(c.req.raw))

// Weekly Book routes
app.post('/scheduled/weekly-book', (c) => weeklyBookHandler(c.req.raw))

export const onRequest = handle(app)
