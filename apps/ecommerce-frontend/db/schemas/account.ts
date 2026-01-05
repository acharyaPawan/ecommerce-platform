import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core"
import { frontendSchema } from "./my-schema"


export const waitlistSignupTable = frontendSchema.table("waitlist_signups", {
  id: uuid("id").primaryKey().defaultRandom(),
  email: text("email").notNull(),
  company: text("company").notNull(),
  intent: text("intent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})

export type WaitlistSignupRecord = typeof waitlistSignupTable.$inferSelect
