import { z } from "zod"

export const waitlistSubmissionSchema = z.object({
  email: z.string().email(),
  company: z.string().min(2),
  intent: z.enum(["retail", "hospitality", "workspace", "hybrid"]),
})

export type WaitlistSubmissionDTO = z.infer<typeof waitlistSubmissionSchema>
