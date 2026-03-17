import { and, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import db from "../db/index.js";
import { interactionEvents, interactionIngestionKeys } from "../db/schema.js";
import type {
  InteractionEventIngest,
  InteractionEventSource,
  InteractionEventType,
} from "@ecommerce/events";

export type RecordInteractionInput = {
  eventType: InteractionEventType;
  source: InteractionEventSource;
  userId?: string;
  sessionId?: string;
  productId: string;
  variantId?: string;
  occurredAt?: string;
  properties?: Record<string, unknown>;
  ingestionKey?: string;//has role in idempotency/deduplication
};

export type RecordedInteractionEvent = {
  id: string;
  eventType: InteractionEventType;
  source: InteractionEventSource;
  userId: string | null;
  sessionId: string | null;
  productId: string;
  variantId: string | null;
  properties: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
  idempotent: boolean;
};

export async function recordInteractionEvent(
  input: RecordInteractionInput
): Promise<RecordedInteractionEvent> {
  const ingestionKey = input.ingestionKey?.trim();
  if (ingestionKey) {
    const existing = await db
      .select({
        event: interactionEvents,
      })
      .from(interactionIngestionKeys)
      .innerJoin(
        interactionEvents,
        eq(interactionIngestionKeys.eventId, interactionEvents.id)
      )
      .where(eq(interactionIngestionKeys.key, ingestionKey))
      .limit(1);

    if (existing[0]) {
      return serializeRecordedEvent(existing[0].event, true);
    }
  }

  const eventId = randomUUID();
  const now = new Date();
  const occurredAt = input.occurredAt ? new Date(input.occurredAt) : now;

  const created = await db.transaction(async (tx) => {
    const [insertedEvent] = await tx
      .insert(interactionEvents)
      .values({
        id: eventId,
        eventType: input.eventType,
        source: input.source,
        userId: input.userId ?? null,
        sessionId: input.sessionId ?? null,
        productId: input.productId,
        variantId: input.variantId ?? null,
        properties: input.properties ?? {},
        occurredAt,
        createdAt: now,
      })
      .returning();

    if (!insertedEvent) {
      throw new Error("Failed to insert interaction event");
    }

    if (ingestionKey) {
      await tx.insert(interactionIngestionKeys).values({
        id: randomUUID(),
        key: ingestionKey,
        eventId,
        createdAt: now,
      });
    }

    return insertedEvent;
  });

  return serializeRecordedEvent(created, false);
}

function serializeRecordedEvent(
  event: typeof interactionEvents.$inferSelect,
  idempotent: boolean
): RecordedInteractionEvent {
  return {
    id: event.id,
    eventType: event.eventType as InteractionEventType,
    source: event.source as InteractionEventSource,
    userId: event.userId,
    sessionId: event.sessionId,
    productId: event.productId,
    variantId: event.variantId,
    properties: event.properties,
    occurredAt: event.occurredAt.toISOString(),
    createdAt: event.createdAt.toISOString(),
    idempotent,
  };
}

export function resolveInteractionActor(
  input: InteractionEventIngest,
  options: {
    authenticatedUserId?: string;
    trustedInternalCall?: boolean;
  }
): Pick<RecordInteractionInput, "userId" | "sessionId"> {
  if (options.trustedInternalCall) {
    return {
      userId: input.userId,
      sessionId: input.sessionId,
    };
  }

  const authenticatedUserId = options.authenticatedUserId?.trim();
  if (authenticatedUserId) {
    if (input.userId && input.userId !== authenticatedUserId) {
      throw new Error("Authenticated user does not match payload userId");
    }

    return {
      userId: authenticatedUserId,
      sessionId: input.sessionId,
    };
  }

  return {
    userId: undefined,
    sessionId: input.sessionId,
  };
}
