import { and, desc, eq, gte, inArray, ne, or, type SQL } from "drizzle-orm";
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

export type RelatedProductRecommendation = {
  productId: string;
  score: number;
  supportingSignals: number;
  strongestEventType: InteractionEventType;
};

type ActorKey = `u:${string}` | `s:${string}`;

type InteractionRow = Pick<
  typeof interactionEvents.$inferSelect,
  "productId" | "userId" | "sessionId" | "eventType" | "occurredAt"
>;

const EVENT_WEIGHTS: Record<InteractionEventType, number> = {
  view: 1,       // saw it
  click: 2,      // interacted
  wishlist_add: 3,   // interested
  cart_add: 4,   // strong intent
  rating: 5,     // engaged
  review: 5,     // engaged
  purchase: 6,   // highest signal
};

/**
 * Records a single user interaction (view, click, purchase, etc.) with idempotency support.
 *
 * What it does:
 * - If `ingestionKey` provided → checks if event already exists (dedup)
 * - If exists → returns cached event with `idempotent: true`
 * - If not → inserts new event + ingestion key in a DB transaction
 * - Returns serialized event with `idempotent: false`
 *
 * Why: Prevents duplicate events if the same request is retried.
 */
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

/**
 * Finds products frequently viewed by users who viewed the anchor product.
 *
 * Algorithm:
 * 1. Fetch all interactions on anchor `productId` (within lookback window)
 * 2. Extract actor identities (users/sessions) → build weighted scores
 * 3. Find OTHER products these actors interacted with
 * 4. Score candidates by weight × event-type multiplier
 * 5. Sort by score, then signals count
 * 6. Fallback to popular products if not enough recommendations
 *
 * Example:
 *   User A viewed ProductX + ProductY
 *   User B viewed ProductX + ProductZ
 *   → Recommend Y & Z when querying ProductX
 */
export async function getRelatedProductRecommendations(input: {
  productId: string;
  limit?: number;
  lookbackDays?: number;
}): Promise<RelatedProductRecommendation[]> {
  const limit = clamp(input.limit ?? 6, 1, 24);
  const lookbackDays = clamp(input.lookbackDays ?? 90, 7, 365);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const anchorEvents = await db
    .select({
      productId: interactionEvents.productId,
      userId: interactionEvents.userId,
      sessionId: interactionEvents.sessionId,
      eventType: interactionEvents.eventType,
      occurredAt: interactionEvents.occurredAt,
    })
    .from(interactionEvents)
    .where(
      and(
        eq(interactionEvents.productId, input.productId),
        gte(interactionEvents.occurredAt, since)
      )
    );

  const actorWeights = buildActorWeights(anchorEvents);
  // actorWeights maps each user/session to their max interaction weight on the anchor product.
  // Used later to score OTHER products these actors interacted with.
  let recommendations: RelatedProductRecommendation[] = [];

  if (actorWeights.size > 0) {
    const userIds = Array.from(actorWeights.keys())
      .filter((key): key is `u:${string}` => key.startsWith("u:"))
      .map((key) => key.slice(2));
    const sessionIds = Array.from(actorWeights.keys())
      .filter((key): key is `s:${string}` => key.startsWith("s:"))
      .map((key) => key.slice(2));

    const candidateConditions = [];
    if (userIds.length > 0) {
      candidateConditions.push(inArray(interactionEvents.userId, userIds));
    }
    if (sessionIds.length > 0) {
      candidateConditions.push(inArray(interactionEvents.sessionId, sessionIds));
    }

    if (candidateConditions.length > 0) {
      const candidateEvents = await db
        .select({
          productId: interactionEvents.productId,
          userId: interactionEvents.userId,
          sessionId: interactionEvents.sessionId,
          eventType: interactionEvents.eventType,
          occurredAt: interactionEvents.occurredAt,
        })
        .from(interactionEvents)
        .where(
          and(
            candidateConditions.length === 1
              ? candidateConditions[0]!
              : or(...candidateConditions),
            ne(interactionEvents.productId, input.productId),
            gte(interactionEvents.occurredAt, since)
          )
        );

      recommendations = scoreRelatedProducts(candidateEvents, actorWeights).slice(
        0,
        limit
      );
    }
  }

  if (recommendations.length >= limit) {
    return recommendations;
  }

  const excluded = new Set([input.productId, ...recommendations.map((item) => item.productId)]);
  const fallback = await getPopularProductFallback({
    since,
    excludeProductIds: Array.from(excluded),
    limit: limit - recommendations.length,
  });

  return [...recommendations, ...fallback].slice(0, limit);
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

/**
 * Determines trusted `userId`/`sessionId` based on request context.
 *
 * Rules:
 * - Trusted internal call → use payload as-is
 * - Authenticated user → use it, reject if payload claims different user
 * - Anonymous → force `userId = undefined`, keep `sessionId`
 *
 * Why: Security—prevents clients from spoofing other users.
 */
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

/**
 * Extract user/session identities from events, assign max event weight per actor.
 * Returns a Map where keys are actor identifiers (`u:${userId}` or `s:${sessionId}`)
 * and values are the highest event weight that actor performed on the anchor product.
 */
function buildActorWeights(events: InteractionRow[]): Map<ActorKey, number> {
  const actorWeights = new Map<ActorKey, number>();

  for (const event of events) {
    const actorKey = toActorKey(event);
    if (!actorKey) {
      continue;
    }

    const nextWeight = EVENT_WEIGHTS[event.eventType as InteractionEventType] ?? 1;
    const current = actorWeights.get(actorKey) ?? 0;
    if (nextWeight > current) {
      actorWeights.set(actorKey, nextWeight);
    }
  }

  return actorWeights;
}

/**
 * Multiply actor weight × event weight for each candidate product.
 * Aggregates scores across all events, tracks supporting signals and strongest event type.
 * Returns products sorted by score (desc), then supporting signals (desc), then productId (asc).
 * Look upon this to learn more: 
 */
function scoreRelatedProducts(
  events: InteractionRow[],
  actorWeights: Map<ActorKey, number>
): RelatedProductRecommendation[] {
  const scored = new Map<
    string,
    {
      score: number;
      supportingSignals: number;
      strongestEventType: InteractionEventType;
      strongestWeight: number;
    }
  >();

  for (const event of events) {
    const actorKey = toActorKey(event);
    if (!actorKey) {
      continue;
    }

    const actorWeight = actorWeights.get(actorKey);
    if (!actorWeight) {
      continue;
    }

    const eventType = event.eventType as InteractionEventType;
    const eventWeight = EVENT_WEIGHTS[eventType] ?? 1;
    const nextScore = actorWeight * eventWeight;

    const existing = scored.get(event.productId);
    if (!existing) {
      scored.set(event.productId, {
        score: nextScore,
        supportingSignals: 1,
        strongestEventType: eventType,
        strongestWeight: eventWeight,
      });
      continue;
    }

    existing.score += nextScore;
    existing.supportingSignals += 1;
    if (eventWeight > existing.strongestWeight) {
      existing.strongestWeight = eventWeight;
      existing.strongestEventType = eventType;
    }
  }

  return Array.from(scored.entries())
    .map(([productId, value]) => ({
      productId,
      score: roundScore(value.score),
      supportingSignals: value.supportingSignals,
      strongestEventType: value.strongestEventType,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.supportingSignals !== a.supportingSignals) {
        return b.supportingSignals - a.supportingSignals;
      }
      return a.productId.localeCompare(b.productId);
    });
}

/**
 * Rank all products by event weight when personalized recommendations insufficient.
 * Excludes products already in recommendations and the anchor product.
 * Used as fallback when actor-based scoring yields fewer results than requested limit.
 */
async function getPopularProductFallback(input: {
  since: Date;
  excludeProductIds: string[];
  limit: number;
}): Promise<RelatedProductRecommendation[]> {
  if (input.limit <= 0) {
    return [];
  }

  const rows = await db
    .select({
      productId: interactionEvents.productId,
      eventType: interactionEvents.eventType,
    })
    .from(interactionEvents)
    .where(gte(interactionEvents.occurredAt, input.since))
    .orderBy(desc(interactionEvents.occurredAt));

  const scores = new Map<
    string,
    { score: number; supportingSignals: number; strongestEventType: InteractionEventType; strongestWeight: number }
  >();
  const excluded = new Set(input.excludeProductIds);

  for (const row of rows) {
    if (excluded.has(row.productId)) {
      continue;
    }
    const eventType = row.eventType as InteractionEventType;
    const eventWeight = EVENT_WEIGHTS[eventType] ?? 1;
    const existing = scores.get(row.productId);
    if (!existing) {
      scores.set(row.productId, {
        score: eventWeight,
        supportingSignals: 1,
        strongestEventType: eventType,
        strongestWeight: eventWeight,
      });
      continue;
    }

    existing.score += eventWeight;
    existing.supportingSignals += 1;
    if (eventWeight > existing.strongestWeight) {
      existing.strongestWeight = eventWeight;
      existing.strongestEventType = eventType;
    }
  }

  return Array.from(scores.entries())
    .map(([productId, value]) => ({
      productId,
      score: roundScore(value.score),
      supportingSignals: value.supportingSignals,
      strongestEventType: value.strongestEventType,
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.supportingSignals !== a.supportingSignals) {
        return b.supportingSignals - a.supportingSignals;
      }
      return a.productId.localeCompare(b.productId);
    })
    .slice(0, input.limit);
}

/**
 * Convert `userId` or `sessionId` to `u:${id}` or `s:${id}` format.
 * Returns null if neither is present.
 */
function toActorKey(event: Pick<InteractionRow, "userId" | "sessionId">): ActorKey | null {
  if (event.userId) {
    return `u:${event.userId}`;
  }
  if (event.sessionId) {
    return `s:${event.sessionId}`;
  }
  return null;
}

/**
 * Round to 2 decimal places for consistency (e.g., 12.345 → 12.35).
 */
function roundScore(value: number): number {
  return Math.round(value * 100) / 100;
}

/**
 * Constrain value within min/max bounds.
 */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
