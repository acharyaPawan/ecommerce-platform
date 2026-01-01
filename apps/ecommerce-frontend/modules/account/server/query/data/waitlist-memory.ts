import { type WaitlistSignupRecord } from "@/db/schemas/account"

const waitlistInMemoryStore: WaitlistSignupRecord[] = []

export function addWaitlistMemoryEntry(entry: WaitlistSignupRecord) {
  waitlistInMemoryStore.unshift(entry)
}

export function getWaitlistMemory() {
  return waitlistInMemoryStore
}
