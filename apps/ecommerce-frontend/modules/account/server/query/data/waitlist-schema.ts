import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core"

export const waitlistSignupTable = pgTable("waitlist_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  intent: text("intent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type WaitlistSignupRecord = typeof waitlistSignupTable.$inferSelect
