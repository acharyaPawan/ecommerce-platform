import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core"

const frontend = pgSchema("frontend")

export const waitlistSignupTable = frontend.table("waitlist_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  intent: text("intent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type WaitlistSignupRecord = typeof waitlistSignupTable.$inferSelect
