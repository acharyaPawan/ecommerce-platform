import type { AnyInventoryEvent } from "./events.js";

export const mapInventoryEventToOutboxRecord = (event: AnyInventoryEvent) => ({
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
