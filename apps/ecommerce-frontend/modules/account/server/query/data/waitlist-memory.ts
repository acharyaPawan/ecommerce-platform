import { type WaitlistSignupRecord } from "./waitlist-schema"

const waitlistInMemoryStore: WaitlistSignupRecord[] = []

export function addWaitlistMemoryEntry(entry: WaitlistSignupRecord) {
  waitlistInMemoryStore.unshift(entry)
}

export function getWaitlistMemory() {
  return waitlistInMemoryStore
}
