import { cache } from "react"

import { count, desc } from "drizzle-orm"

import { waitlistSignupTable } from "@/db/schemas/account"
import { db } from "@/lib/drizzle/client"

import { getWaitlistMemory } from "../data/waitlist-memory"

export type WaitlistInsights = {
  totalSignups: number
  recentCompanies: string[]
}

export const getWaitlistInsights = cache(async (): Promise<WaitlistInsights> => {
  if (!db) {
    const memory = getWaitlistMemory()
    return {
      totalSignups: 120 + memory.length,
      recentCompanies: memory.slice(0, 3).map((entry) => entry.company),
    }
  }

  const [countRow] = await db.select({ value: count() }).from(waitlistSignupTable)
  const recents = await db
    .select({
      company: waitlistSignupTable.company,
    })
    .from(waitlistSignupTable)
    .orderBy(desc(waitlistSignupTable.createdAt))
    .limit(3)

  return {
    totalSignups: Number(countRow?.value ?? 0),
    recentCompanies: recents.map((row) => row.company),
  }
})
