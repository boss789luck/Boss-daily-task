import "dotenv/config";
import { getDb } from "./server/db";
import { users } from "./drizzle/schema";
import { eq } from "drizzle-orm";

async function main() {
  try {
    const db = await getDb();
    if (!db) { console.log("No DB"); return; }
    const existing = await db.select().from(users).where(eq(users.id, 1)).limit(1);
    if (existing.length === 0) {
      await db.insert(users).values({
        id: 1,
        openId: "local",
        name: "Boss",
        email: "boss@example.com",
        role: "admin",
        createdAt: new Date(),
        updatedAt: new Date(),
        lastSignedIn: new Date(),
        loginMethod: "local"
      });
      console.log("Mock user inserted");
    } else {
      console.log("Mock user already exists");
    }
  } catch (e) {
    console.error(e);
  }
}
main();
