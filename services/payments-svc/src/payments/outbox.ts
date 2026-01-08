import type { AnyPaymentEvent } from "./events.js";

export const mapPaymentEventToOutboxRecord = (event: AnyPaymentEvent) => ({
  id: event.id,
  type: event.type,
  aggregateId: event.aggregateId,
  aggregateType: event.aggregateType,
  payload: event.payload,
  occurredAt: new Date(event.occurredAt),
  correlationId: event.correlationId ?? null,
  causationId: event.causationId ?? null,
  status: "pending" as const,
  error: null as string | null,
});
