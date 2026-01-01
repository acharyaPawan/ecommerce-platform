"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { db } from "@/lib/drizzle/client"

import { addWaitlistMemoryEntry } from "../query/data/waitlist-memory"
import { waitlistSignupTable } from "../query/data/waitlist-schema"
import { waitlistSubmissionSchema } from "../query/dto/waitlist-dto"

const waitlistActionSchema = waitlistSubmissionSchema.extend({
  intentDetail: z.string().optional(),
})

export type WaitlistActionInput = z.infer<typeof waitlistActionSchema>

export async function joinWaitlistAction(input: WaitlistActionInput) {
  const payload = waitlistActionSchema.parse(input)

  console.info("Waitlist submission", payload)

  try {
    if (db) {
      await db.insert(waitlistSignupTable).values({
        email: payload.email,
        company: payload.company,
        intent: payload.intent,
      })
    } else {
      addWaitlistMemoryEntry({
        id: crypto.randomUUID(),
        email: payload.email,
        company: payload.company,
        intent: payload.intent,
        createdAt: new Date(),
      })
    }
  } catch (error) {
    console.error("Failed to store waitlist entry", error)
    throw new Error("Unable to save your submission right now.")
  }

  revalidatePath("/")

  return { ok: true }
}
