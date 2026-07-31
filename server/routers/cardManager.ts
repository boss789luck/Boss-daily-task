import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { cards, entities, cardEntityLinks, users } from "../../drizzle/schema";
import { eq, and, sql } from "drizzle-orm";

export const cardManagerRouter = router({
  // CARDS
  getCards: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      const allCards = await db.select().from(cards).where(eq(cards.userId, ctx.user.id));
      
      const results = [];
      for (const c of allCards) {
        results.push({
          ...c,
          cardNumberFull: c.cardNumberEncrypted,
          expiryRaw: c.expiryEncrypted,
          cvvRaw: c.cvvEncrypted,
          cardholderRaw: c.cardholderNameEncrypted,
          isDecrypted: true // Always treat as decrypted now since we store plaintext
        });
      }
      return results;
    }),

  createCard: protectedProcedure
    .input(z.object({
      cardName: z.string(),
      bankName: z.string().optional(),
      cardNumber: z.string(),
      expiry: z.string(),
      cvv: z.string(),
      cardholderName: z.string().optional(),
      linkedBankAccount: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB error");

      const last4 = input.cardNumber.slice(-4);

      await db.insert(cards).values({
        userId: ctx.user.id,
        cardName: input.cardName,
        bankName: input.bankName,
        linkedBankAccount: input.linkedBankAccount,
        cardNumberLast4: last4,
        cardNumberEncrypted: input.cardNumber, // Store as plaintext
        expiryEncrypted: input.expiry,
        cvvEncrypted: input.cvv,
        cardholderNameEncrypted: input.cardholderName || null
      });
      return { success: true };
    }),

  updateCard: protectedProcedure
    .input(z.object({
      id: z.number(),
      cardName: z.string().optional(),
      bankName: z.string().optional(),
      cardNumber: z.string().optional(),
      expiry: z.string().optional(),
      cvv: z.string().optional(),
      cardholderName: z.string().optional(),
      linkedBankAccount: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB error");

      const updateData: any = {};
      if (input.cardName) updateData.cardName = input.cardName;
      if (input.bankName !== undefined) updateData.bankName = input.bankName;
      if (input.linkedBankAccount !== undefined) updateData.linkedBankAccount = input.linkedBankAccount;
      if (input.cardNumber) {
        updateData.cardNumberEncrypted = input.cardNumber;
        updateData.cardNumberLast4 = input.cardNumber.slice(-4);
      }
      if (input.expiry) updateData.expiryEncrypted = input.expiry;
      if (input.cvv) updateData.cvvEncrypted = input.cvv;
      if (input.cardholderName !== undefined) updateData.cardholderNameEncrypted = input.cardholderName;

      await db.update(cards).set(updateData).where(and(eq(cards.id, input.id), eq(cards.userId, ctx.user.id)));
      return { success: true };
    }),

  deleteCard: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB error");
      await db.delete(cardEntityLinks).where(eq(cardEntityLinks.cardId, input.id));
      await db.delete(cards).where(and(eq(cards.id, input.id), eq(cards.userId, ctx.user.id)));
      return { success: true };
    }),

  // ENTITIES
  getEntities: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      return await db.select().from(entities).where(eq(entities.userId, ctx.user.id));
    }),

  createEntity: protectedProcedure
    .input(z.object({
      name: z.string(),
      type: z.enum(["page", "business_manager", "ad_account", "fb_profile", "subscription"]),
      loginNote: z.string().optional(),
      status: z.enum(["active", "paused", "banned", "unknown"]).optional(),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB error");
      await db.insert(entities).values({
        userId: ctx.user.id,
        name: input.name,
        type: input.type,
        loginNote: input.loginNote,
        status: input.status || "active",
        notes: input.notes
      });
      return { success: true };
    }),

  updateEntity: protectedProcedure
    .input(z.object({
      id: z.number(),
      name: z.string().optional(),
      type: z.enum(["page", "business_manager", "ad_account", "fb_profile", "subscription"]).optional(),
      loginNote: z.string().optional(),
      status: z.enum(["active", "paused", "banned", "unknown"]).optional(),
      notes: z.string().optional()
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB error");

      const updateData: any = {};
      if (input.name) updateData.name = input.name;
      if (input.type) updateData.type = input.type;
      if (input.loginNote !== undefined) updateData.loginNote = input.loginNote;
      if (input.status) updateData.status = input.status;
      if (input.notes !== undefined) updateData.notes = input.notes;

      await db.update(entities).set(updateData).where(and(eq(entities.id, input.id), eq(entities.userId, ctx.user.id)));
      return { success: true };
    }),

  deleteEntity: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB error");
      await db.delete(cardEntityLinks).where(eq(cardEntityLinks.entityId, input.id));
      await db.delete(entities).where(and(eq(entities.id, input.id), eq(entities.userId, ctx.user.id)));
      return { success: true };
    }),

  // LINKS
  getLinks: protectedProcedure
    .query(async ({ ctx }) => {
      const db = await getDb();
      if (!db) return [];
      // To ensure user owns the card, we could join, but we just return all links for cards owned by user
      const userCards = await db.select({ id: cards.id }).from(cards).where(eq(cards.userId, ctx.user.id));
      const cardIds = userCards.map(c => c.id);
      if (cardIds.length === 0) return [];
      return await db.select().from(cardEntityLinks).where(sql`${cardEntityLinks.cardId} IN ${cardIds}`);
    }),

  linkCardToEntity: protectedProcedure
    .input(z.object({ cardId: z.number(), entityId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB error");
      
      const existing = await db.select().from(cardEntityLinks)
        .where(and(eq(cardEntityLinks.cardId, input.cardId), eq(cardEntityLinks.entityId, input.entityId))).get();
      
      if (!existing) {
        await db.insert(cardEntityLinks).values({
          userId: ctx.user.id,
          cardId: input.cardId,
          entityId: input.entityId
        });
      }
      return { success: true };
    }),

  unlinkCardFromEntity: protectedProcedure
    .input(z.object({ cardId: z.number(), entityId: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB error");
      await db.delete(cardEntityLinks)
        .where(and(eq(cardEntityLinks.cardId, input.cardId), eq(cardEntityLinks.entityId, input.entityId)));
      return { success: true };
    }),

  createLinkSetup: protectedProcedure
    .input(z.object({
      card: z.union([z.number(), z.string()]),
      profile: z.union([z.number(), z.string()]).optional(),
      page: z.union([z.number(), z.string()]).optional(),
      adAccount: z.union([z.number(), z.string()]).optional(),
      subscription: z.union([z.number(), z.string()]).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("DB error");

      // 1. Resolve Card
      let cardId: number;
      if (typeof input.card === "number") {
        cardId = input.card;
      } else {
        const existingCard = await db.select().from(cards).where(and(eq(cards.cardName, input.card), eq(cards.userId, ctx.user.id))).get();
        if (existingCard) {
          cardId = existingCard.id;
        } else {
          const res = await db.insert(cards).values({
            userId: ctx.user.id,
            cardName: input.card,
            cardNumberEncrypted: "",
            cardNumberLast4: "",
            expiryEncrypted: "",
            cvvEncrypted: ""
          }).returning({ id: cards.id });
          cardId = res[0].id;
        }
      }

      // Helper to resolve or create entity
      const resolveEntity = async (val: number | string | undefined, type: "page" | "business_manager" | "ad_account" | "fb_profile" | "subscription") => {
        if (val === undefined || val === "") return null;
        if (typeof val === "number") return val;
        
        const existingEntity = await db.select().from(entities).where(and(eq(entities.name, val), eq(entities.type, type), eq(entities.userId, ctx.user.id))).get();
        if (existingEntity) return existingEntity.id;

        const res = await db.insert(entities).values({
          userId: ctx.user.id,
          name: val,
          type: type,
          status: "active"
        }).returning({ id: entities.id });
        return res[0].id;
      };

      const entityIds = [
        await resolveEntity(input.profile, "fb_profile"),
        await resolveEntity(input.page, "page"),
        await resolveEntity(input.adAccount, "ad_account"),
        await resolveEntity(input.subscription, "subscription")
      ].filter(Boolean) as number[];

      // Create Links
      for (const entityId of entityIds) {
        const existing = await db.select().from(cardEntityLinks)
          .where(and(eq(cardEntityLinks.cardId, cardId), eq(cardEntityLinks.entityId, entityId))).get();
        if (!existing) {
          await db.insert(cardEntityLinks).values({
            userId: ctx.user.id,
            cardId: cardId,
            entityId: entityId
          });
        }
      }

      return { success: true };
    })
});
