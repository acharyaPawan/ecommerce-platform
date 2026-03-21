import { and, desc, eq, gte, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import db from "../db/index.js";
import { interactionEvents, interactionIngestionKeys } from "../db/schema.js";
import { catalogCategories, catalogProductCategories } from "../db/external-schema.js";
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
  explanation: RecommendationBehaviorExplanation;
  diagnostics: RecommendationDiagnostics;
};

export type RecommendationBehaviorExplanation = {
  basis: "related_behavior" | "personal_behavior" | "popular_fallback";
  summary: string;
  reasons: string[];
  contributingActors: number;
  seedProductIds?: string[];
  anchorProductId?: string;
};

export type RecommendationDiagnostics = {
  source: "collaborative" | "popular_fallback";
  selectionStage:
    | "primary_diversified"
    | "primary_relaxed"
    | "low_support_backfill"
    | "popular_backfill";
  rawBehaviorScore: number;
  fallbackUsed: boolean;
  actorThresholdPassed: boolean;
  diversifiedBySignal: boolean;
  contributingActors: number;
};

export type RecommendationInspectionSnapshot = {
  generatedAt: string;
  lookbackDays: number;
  sampleAnchorCount: number;
  metrics: {
    totalInteractions: number;
    uniqueUsers: number;
    uniqueSessions: number;
    uniqueActors: number;
    uniqueProducts: number;
    eventTypeBreakdown: Record<InteractionEventType, number>;
    recommendationCount: number;
    collaborativeCount: number;
    fallbackCount: number;
    lowSupportCount: number;
    diversifiedCount: number;
    fallbackRate: number;
    lowSupportRate: number;
    diversifiedRate: number;
    stageBreakdown: Record<RecommendationDiagnostics["selectionStage"], number>;
  };
  anchors: RecommendationInspectionAnchor[];
};

export type RecommendationInspectionAnchor = {
  productId: string;
  interactionCount: number;
  recommendations: RelatedProductRecommendation[];
};

export type CategoryForecastSnapshot = {
  generatedAt: string;
  lookbackDays: number;
  horizonDays: number;
  categories: CategoryDemandForecast[];
};

export type CategoryDemandForecast = {
  categoryId: string;
  categoryName: string;
  totalObservedUnits: number;
  avgDailyUnits: number;
  recentWindowUnits: number;
  previousWindowUnits: number;
  trendPct: number;
  projectedUnits: number;
  confidence: "high" | "medium" | "low";
  demandStatus: "rising" | "stable" | "softening";
  riskLevel: "high" | "medium" | "low";
  urgency: "urgent" | "watch" | "stable";
  safetyBufferUnits: number;
  planningUnits: number;
  narrative: string;
  history: Array<{ date: string; units: number }>;
  forecast: Array<{ date: string; units: number }>;
};

type RecommendationInspectionSummaryInput = {
  recentEvents: InteractionRow[];
  anchors: RecommendationInspectionAnchor[];
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

const MIN_COLLABORATIVE_ACTOR_SUPPORT = 2;
const MAX_ITEMS_PER_EVENT_TYPE_DURING_DIVERSIFICATION = 2;

export type RecommendationCandidate = {
  productId: string;
  score: number;
  supportingSignals: number;
  strongestEventType: InteractionEventType;
  contributingActors: number;
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

      recommendations = buildCollaborativeRecommendations(
        scoreRelatedProducts(candidateEvents, actorWeights),
        {
          basis: "related_behavior",
          limit,
          anchorProductId: input.productId,
        }
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

export async function getPersonalProductRecommendations(input: {
  userId?: string;
  sessionId?: string;
  limit?: number;
  lookbackDays?: number;
}): Promise<{
  items: RelatedProductRecommendation[];
  seedProductIds: string[];
}> {
  const actor = resolvePreferredActor(input);
  const limit = clamp(input.limit ?? 6, 1, 24);
  const lookbackDays = clamp(input.lookbackDays ?? 120, 14, 365);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  if (!actor) {
    return {
      items: await getPopularProductFallback({
        since,
        excludeProductIds: [],
        limit,
      }),
      seedProductIds: [],
    };
  }

  const actorEvents = await db
    .select({
      productId: interactionEvents.productId,
      userId: interactionEvents.userId,
      sessionId: interactionEvents.sessionId,
      eventType: interactionEvents.eventType,
      occurredAt: interactionEvents.occurredAt,
    })
    .from(interactionEvents)
    .where(and(buildExactActorCondition(actor), gte(interactionEvents.occurredAt, since)));

  // Step 1: Build this actor's product-interest profile.
  // We sum event weights per product so purchases/reviews influence more than views.
  const actorHistory = buildProductHistoryWeights(actorEvents);
  const historyProductIds = Array.from(actorHistory.keys());
  // Keep top seed products for response explainability and troubleshooting.
  const seedProductIds = Array.from(actorHistory.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([productId]) => productId);

  if (historyProductIds.length === 0) {
    return {
      items: await getPopularProductFallback({
        since,
        excludeProductIds: [],
        limit,
      }),
      seedProductIds: [],
    };
  }

  // CohertEvents: "find people like me" signal
  // This mean all events from other actors on products you interacted with.
  const cohortEvents = await db
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
        inArray(interactionEvents.productId, historyProductIds),//productId from actors historyProductsId
        gte(interactionEvents.occurredAt, since),
        excludeExactActorCondition(actor)//excluding actors
      )
    );

  const cohortScores = buildCohortActorScores(cohortEvents, actorHistory);
  // Step 2: Cohort score = overlap on actor's history products.
  // Actors who strongly engage with this actor's top products get higher scores.
  let recommendations: RelatedProductRecommendation[] = [];

  if (cohortScores.size > 0) {
    const userIds = Array.from(cohortScores.keys())
      .filter((key): key is `u:${string}` => key.startsWith("u:"))
      .map((key) => key.slice(2));
    const sessionIds = Array.from(cohortScores.keys())
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
            gte(interactionEvents.occurredAt, since),
            // Recommend only unseen products to avoid echoing history back to the actor.
            notInArray(interactionEvents.productId, historyProductIds)
          )
        );

      // Step 3: Final candidate score = cohort actor score * candidate event weight.
      recommendations = buildCollaborativeRecommendations(
        scoreRelatedProducts(candidateEvents, cohortScores),
        {
          basis: "personal_behavior",
          limit,
          seedProductIds,
        }
      );
    }
  }

  if (recommendations.length >= limit) {
    return {
      items: recommendations,
      seedProductIds,
    };
  }

  const fallback = await getPopularProductFallback({
    since,
    excludeProductIds: [
      ...historyProductIds,
      ...recommendations.map((item) => item.productId),
    ],
    limit: limit - recommendations.length,
  });

  return {
    items: [...recommendations, ...fallback].slice(0, limit),
    seedProductIds,
  };
}

export async function getRecommendationInspectionSnapshot(input?: {
  lookbackDays?: number;
  sampleAnchorLimit?: number;
  recommendationLimit?: number;
}): Promise<RecommendationInspectionSnapshot> {
  const lookbackDays = clamp(input?.lookbackDays ?? 30, 7, 365);
  const sampleAnchorLimit = clamp(input?.sampleAnchorLimit ?? 5, 1, 12);
  const recommendationLimit = clamp(input?.recommendationLimit ?? 6, 1, 12);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const recentEvents = await db
    .select({
      productId: interactionEvents.productId,
      userId: interactionEvents.userId,
      sessionId: interactionEvents.sessionId,
      eventType: interactionEvents.eventType,
      occurredAt: interactionEvents.occurredAt,
    })
    .from(interactionEvents)
    .where(gte(interactionEvents.occurredAt, since));

  const eventSummary = summarizeInteractionWindow(recentEvents);

  const anchorCandidates = Array.from(eventSummary.productCounts.entries())
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return a[0].localeCompare(b[0]);
    })
    .slice(0, sampleAnchorLimit);

  const anchors: RecommendationInspectionAnchor[] = await Promise.all(
    anchorCandidates.map(async ([productId, interactionCount]) => ({
      productId,
      interactionCount,
      recommendations: await getRelatedProductRecommendations({
        productId,
        limit: recommendationLimit,
        lookbackDays,
      }),
    }))
  );

  const metrics = summarizeRecommendationInspection({
    recentEvents,
    anchors,
  });

  return {
    generatedAt: new Date().toISOString(),
    lookbackDays,
    sampleAnchorCount: anchors.length,
    metrics,
    anchors,
  };
}

export async function getCategoryForecastSnapshot(input?: {
  lookbackDays?: number;
  horizonDays?: number;
  limit?: number;
}): Promise<CategoryForecastSnapshot> {
  const lookbackDays = clamp(input?.lookbackDays ?? 60, 14, 365);
  const horizonDays = clamp(input?.horizonDays ?? 14, 7, 60);
  const limit = clamp(input?.limit ?? 6, 1, 24);
  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  const rows = await db
    .select({
      categoryId: catalogCategories.id,
      categoryName: catalogCategories.name,
      bucket: sql<string>`to_char(date_trunc('day', ${interactionEvents.occurredAt}), 'YYYY-MM-DD')`,
      units: sql<number>`sum(coalesce(nullif(${interactionEvents.properties} ->> 'qty', '')::int, 1))`,
    })
    .from(interactionEvents)
    .innerJoin(
      catalogProductCategories,
      eq(catalogProductCategories.productId, interactionEvents.productId)
    )
    .innerJoin(
      catalogCategories,
      eq(catalogCategories.id, catalogProductCategories.categoryId)
    )
    .where(
      and(
        eq(interactionEvents.eventType, "purchase"),
        gte(interactionEvents.occurredAt, since)
      )
    )
    .groupBy(
      catalogCategories.id,
      catalogCategories.name,
      sql`date_trunc('day', ${interactionEvents.occurredAt})`
    );

  const categories = buildCategoryDemandForecasts(rows, {
    lookbackDays,
    horizonDays,
  })
    .sort((a, b) => {
      if (b.projectedUnits !== a.projectedUnits) {
        return b.projectedUnits - a.projectedUnits;
      }
      if (b.totalObservedUnits !== a.totalObservedUnits) {
        return b.totalObservedUnits - a.totalObservedUnits;
      }
      return a.categoryName.localeCompare(b.categoryName);
    })
    .slice(0, limit);

  return {
    generatedAt: new Date().toISOString(),
    lookbackDays,
    horizonDays,
    categories,
  };
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
export function buildActorWeights(events: InteractionRow[]): Map<ActorKey, number> {
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

export function buildProductHistoryWeights(events: InteractionRow[]): Map<string, number> {
  const weights = new Map<string, number>();

  for (const event of events) {
    const eventWeight = EVENT_WEIGHTS[event.eventType as InteractionEventType] ?? 1;
    weights.set(event.productId, (weights.get(event.productId) ?? 0) + eventWeight);
  }

  return weights;
}

export function buildCohortActorScores(
  events: InteractionRow[],
  historyWeights: Map<string, number>
): Map<ActorKey, number> {
  const scores = new Map<ActorKey, number>();

  for (const event of events) {
    const actorKey = toActorKey(event);
    if (!actorKey) {
      continue;
    }

    const anchorWeight = historyWeights.get(event.productId);
    if (!anchorWeight) {
      continue;
    }

    const eventWeight = EVENT_WEIGHTS[event.eventType as InteractionEventType] ?? 1;
    scores.set(actorKey, (scores.get(actorKey) ?? 0) + anchorWeight * eventWeight);
  }

  return scores;
}

/**
 * Multiply actor weight × event weight for each candidate product.
 * Aggregates scores across all events, tracks supporting signals and strongest event type.
 * Returns products sorted by score (desc), then supporting signals (desc), then productId (asc).
 * Look upon this to learn more: 
 */
export function scoreRelatedProducts(
  events: InteractionRow[],
  actorWeights: Map<ActorKey, number>
): RecommendationCandidate[] {
  const scored = new Map<
    string,
    {
      score: number;
      supportingSignals: number;
      strongestEventType: InteractionEventType;
      strongestWeight: number;
      actors: Set<ActorKey>;
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
        actors: new Set([actorKey]),
      });
      continue;
    }

    existing.score += nextScore;
    existing.supportingSignals += 1;
    existing.actors.add(actorKey);
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
      contributingActors: value.actors.size,
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
      userId: interactionEvents.userId,
      sessionId: interactionEvents.sessionId,
      eventType: interactionEvents.eventType,
    })
    .from(interactionEvents)
    .where(gte(interactionEvents.occurredAt, input.since))
    .orderBy(desc(interactionEvents.occurredAt));

  const scores = new Map<
    string,
    {
      score: number;
      supportingSignals: number;
      strongestEventType: InteractionEventType;
      strongestWeight: number;
      actors: Set<ActorKey>;
    }
  >();
  const excluded = new Set(input.excludeProductIds);

  for (const row of rows) {
    if (excluded.has(row.productId)) {
      continue;
    }
    const eventType = row.eventType as InteractionEventType;
    const eventWeight = EVENT_WEIGHTS[eventType] ?? 1;
    const actorKey = toActorKey(row);
    const existing = scores.get(row.productId);
    if (!existing) {
      scores.set(row.productId, {
        score: eventWeight,
        supportingSignals: 1,
        strongestEventType: eventType,
        strongestWeight: eventWeight,
        actors: actorKey ? new Set([actorKey]) : new Set(),
      });
      continue;
    }

    existing.score += eventWeight;
    existing.supportingSignals += 1;
    if (actorKey) {
      existing.actors.add(actorKey);
    }
    if (eventWeight > existing.strongestWeight) {
      existing.strongestWeight = eventWeight;
      existing.strongestEventType = eventType;
    }
  }

  return Array.from(scores.entries())
    .map<RelatedProductRecommendation>(([productId, value]) => ({
      productId,
      score: roundScore(value.score),
      supportingSignals: value.supportingSignals,
      strongestEventType: value.strongestEventType,
      explanation: buildBehaviorExplanation({
        basis: "popular_fallback",
        strongestEventType: value.strongestEventType,
        supportingSignals: value.supportingSignals,
        contributingActors: value.actors.size,
      }),
      diagnostics: {
        source: "popular_fallback",
        selectionStage: "popular_backfill",
        rawBehaviorScore: roundScore(value.score),
        fallbackUsed: true,
        actorThresholdPassed: value.actors.size >= MIN_COLLABORATIVE_ACTOR_SUPPORT,
        diversifiedBySignal: false,
        contributingActors: value.actors.size,
      },
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

export function buildCollaborativeRecommendations(
  candidates: RecommendationCandidate[],
  input: {
    basis: RecommendationBehaviorExplanation["basis"];
    limit: number;
    seedProductIds?: string[];
    anchorProductId?: string;
  }
): RelatedProductRecommendation[] {
  const selectedCandidates = applyRecommendationGuardrails(candidates, input.limit);

  return selectedCandidates.map((item) => ({
    productId: item.productId,
    score: item.score,
    supportingSignals: item.supportingSignals,
    strongestEventType: item.strongestEventType,
    explanation: buildBehaviorExplanation({
      basis: input.basis,
      strongestEventType: item.strongestEventType,
      supportingSignals: item.supportingSignals,
      contributingActors: item.contributingActors,
      seedProductIds: input.seedProductIds,
      anchorProductId: input.anchorProductId,
    }),
    diagnostics: {
      source: "collaborative",
      selectionStage: item.selectionStage,
      rawBehaviorScore: item.score,
      fallbackUsed: false,
      actorThresholdPassed:
        item.contributingActors >= MIN_COLLABORATIVE_ACTOR_SUPPORT,
      diversifiedBySignal: item.selectionStage === "primary_diversified",
      contributingActors: item.contributingActors,
    },
  }));
}

export function applyRecommendationGuardrails(
  candidates: RecommendationCandidate[],
  limit: number
): Array<
  RecommendationCandidate & {
    selectionStage:
      | "primary_diversified"
      | "primary_relaxed"
      | "low_support_backfill";
  }
> {
  if (limit <= 0) {
    return [];
  }

  const robust = candidates.filter(
    (item) => item.contributingActors >= MIN_COLLABORATIVE_ACTOR_SUPPORT
  );
  const sparse = candidates.filter(
    (item) => item.contributingActors < MIN_COLLABORATIVE_ACTOR_SUPPORT
  );
  const uniqueSignalTypes = new Set(
    robust.map((item) => item.strongestEventType)
  ).size;

  const selected: Array<
    RecommendationCandidate & {
      selectionStage:
        | "primary_diversified"
        | "primary_relaxed"
        | "low_support_backfill";
    }
  > = [];
  const skippedForRelaxedPass: RecommendationCandidate[] = [];
  const perEventTypeCounts = new Map<InteractionEventType, number>();

  for (const candidate of robust) {
    const eventCount = perEventTypeCounts.get(candidate.strongestEventType) ?? 0;
    const canDiversify =
      uniqueSignalTypes > 1 &&
      eventCount < MAX_ITEMS_PER_EVENT_TYPE_DURING_DIVERSIFICATION;

    if (canDiversify) {
      selected.push({
        ...candidate,
        selectionStage: "primary_diversified",
      });
      perEventTypeCounts.set(candidate.strongestEventType, eventCount + 1);
    } else {
      skippedForRelaxedPass.push(candidate);
    }

    if (selected.length >= limit) {
      return selected.slice(0, limit);
    }
  }

  for (const candidate of skippedForRelaxedPass) {
    selected.push({
      ...candidate,
      selectionStage: "primary_relaxed",
    });
    if (selected.length >= limit) {
      return selected.slice(0, limit);
    }
  }

  for (const candidate of sparse) {
    selected.push({
      ...candidate,
      selectionStage: "low_support_backfill",
    });
    if (selected.length >= limit) {
      return selected.slice(0, limit);
    }
  }

  return selected;
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

function buildBehaviorExplanation(input: {
  basis: RecommendationBehaviorExplanation["basis"];
  strongestEventType: InteractionEventType;
  supportingSignals: number;
  contributingActors: number;
  seedProductIds?: string[];
  anchorProductId?: string;
}): RecommendationBehaviorExplanation {
  const strongestEventLabel = formatEventType(input.strongestEventType);
  const reasons = [
    `Strongest behavioral signal is ${strongestEventLabel}.`,
    `Built from ${input.supportingSignals} supporting interaction signals.`,
  ];

  if (input.contributingActors > 0) {
    reasons.push(
      `Backed by ${input.contributingActors} similar shopper or session profiles.`
    );
  }

  if (input.basis === "related_behavior" && input.anchorProductId) {
    reasons.unshift(
      `Derived from shoppers who also interacted with product ${input.anchorProductId}.`
    );
  }

  if (input.basis === "personal_behavior" && input.seedProductIds && input.seedProductIds.length > 0) {
    reasons.unshift(
      `Grounded in your strongest recent products: ${input.seedProductIds.slice(0, 3).join(", ")}.`
    );
  }

  switch (input.basis) {
    case "related_behavior":
      return {
        basis: input.basis,
        summary: "Recommended from shoppers who also engaged with the current product.",
        reasons: reasons.slice(0, 3),
        contributingActors: input.contributingActors,
        anchorProductId: input.anchorProductId,
      };
    case "personal_behavior":
      return {
        basis: input.basis,
        summary: "Recommended from your activity history and similar shopper behavior.",
        reasons: reasons.slice(0, 3),
        contributingActors: input.contributingActors,
        seedProductIds: input.seedProductIds,
      };
    case "popular_fallback":
      return {
        basis: input.basis,
        summary: "Recommended from recent storefront momentum.",
        reasons: reasons.slice(0, 3),
        contributingActors: input.contributingActors,
      };
  }
}

function formatEventType(eventType: InteractionEventType): string {
  switch (eventType) {
    case "cart_add":
      return "cart add";
    case "wishlist_add":
      return "wishlist add";
    default:
      return eventType;
  }
}

function resolvePreferredActor(input: {
  userId?: string;
  sessionId?: string;
}): { userId?: string; sessionId?: string } | null {
  if (input.userId?.trim()) {
    return { userId: input.userId.trim() };
  }
  if (input.sessionId?.trim()) {
    return { sessionId: input.sessionId.trim() };
  }
  return null;
}

function buildExactActorCondition(actor: { userId?: string; sessionId?: string }) {
  if (actor.userId) {
    return eq(interactionEvents.userId, actor.userId);
  }
  return eq(interactionEvents.sessionId, actor.sessionId!);
}

function excludeExactActorCondition(actor: { userId?: string; sessionId?: string }) {
  if (actor.userId) {
    return ne(interactionEvents.userId, actor.userId);
  }
  return ne(interactionEvents.sessionId, actor.sessionId!);
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

function createEventTypeCounter(): Record<InteractionEventType, number> {
  return {
    view: 0,
    click: 0,
    wishlist_add: 0,
    cart_add: 0,
    purchase: 0,
    rating: 0,
    review: 0,
  };
}

function createSelectionStageCounter(): Record<
  RecommendationDiagnostics["selectionStage"],
  number
> {
  return {
    primary_diversified: 0,
    primary_relaxed: 0,
    low_support_backfill: 0,
    popular_backfill: 0,
  };
}

export function toRate(count: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return roundScore((count / total) * 100);
}

export function summarizeRecommendationInspection(
  input: RecommendationInspectionSummaryInput
): RecommendationInspectionSnapshot["metrics"] {
  const eventSummary = summarizeInteractionWindow(input.recentEvents);
  const recommendationItems = input.anchors.flatMap((anchor) => anchor.recommendations);
  const stageBreakdown = createSelectionStageCounter();

  for (const item of recommendationItems) {
    stageBreakdown[item.diagnostics.selectionStage] += 1;
  }

  const collaborativeCount = recommendationItems.filter(
    (item) => item.diagnostics.source === "collaborative"
  ).length;
  const fallbackCount = recommendationItems.filter(
    (item) => item.diagnostics.fallbackUsed
  ).length;
  const lowSupportCount = recommendationItems.filter(
    (item) => !item.diagnostics.actorThresholdPassed
  ).length;
  const diversifiedCount = recommendationItems.filter(
    (item) => item.diagnostics.diversifiedBySignal
  ).length;
  const recommendationCount = recommendationItems.length;

  return {
    totalInteractions: input.recentEvents.length,
    uniqueUsers: eventSummary.users.size,
    uniqueSessions: eventSummary.sessions.size,
    uniqueActors: eventSummary.actors.size,
    uniqueProducts: eventSummary.productCounts.size,
    eventTypeBreakdown: eventSummary.eventTypeBreakdown,
    recommendationCount,
    collaborativeCount,
    fallbackCount,
    lowSupportCount,
    diversifiedCount,
    fallbackRate: toRate(fallbackCount, recommendationCount),
    lowSupportRate: toRate(lowSupportCount, recommendationCount),
    diversifiedRate: toRate(diversifiedCount, recommendationCount),
    stageBreakdown,
  };
}

export function buildCategoryDemandForecasts(
  rows: Array<{
    categoryId: string;
    categoryName: string;
    bucket: string;
    units: number;
  }>,
  input: {
    lookbackDays: number;
    horizonDays: number;
  }
): CategoryDemandForecast[] {
  const today = startOfUtcDay(new Date());
  const dayKeys = Array.from({ length: input.lookbackDays }, (_, index) => {
    const current = new Date(today);
    current.setUTCDate(today.getUTCDate() - (input.lookbackDays - index - 1));
    return formatDateKey(current);
  });

  const rowsByCategory = new Map<
    string,
    {
      categoryName: string;
      byDate: Map<string, number>;
    }
  >();

  for (const row of rows) {
    const existing = rowsByCategory.get(row.categoryId);
    if (!existing) {
      rowsByCategory.set(row.categoryId, {
        categoryName: row.categoryName,
        byDate: new Map([[row.bucket, row.units]]),
      });
      continue;
    }

    existing.byDate.set(row.bucket, (existing.byDate.get(row.bucket) ?? 0) + row.units);
  }

  return Array.from(rowsByCategory.entries()).map(([categoryId, value]) => {
    const series = dayKeys.map((date) => ({
      date,
      units: value.byDate.get(date) ?? 0,
    }));

    return forecastCategoryDemandFromSeries(
      {
        categoryId,
        categoryName: value.categoryName,
        series,
      },
      { horizonDays: input.horizonDays }
    );
  });
}

export function forecastCategoryDemandFromSeries(
  input: {
    categoryId: string;
    categoryName: string;
    series: Array<{ date: string; units: number }>;
  },
  options: {
    horizonDays: number;
  }
): CategoryDemandForecast {
  const series = input.series;
  const windowSize = Math.min(7, Math.max(series.length, 1));
  const recentWindow = series.slice(-windowSize);
  const previousWindow = series.slice(-windowSize * 2, -windowSize);

  const totalObservedUnits = series.reduce((sum, point) => sum + point.units, 0);
  const recentWindowUnits = recentWindow.reduce((sum, point) => sum + point.units, 0);
  const previousWindowUnits = previousWindow.reduce((sum, point) => sum + point.units, 0);
  const avgDailyUnits = roundScore(totalObservedUnits / Math.max(series.length, 1));
  const recentAvg = recentWindowUnits / Math.max(recentWindow.length, 1);
  const previousAvg = previousWindowUnits / Math.max(previousWindow.length, 1);
  const rawTrend =
    previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : recentAvg > 0 ? 100 : 0;
  const trendPct = roundScore(rawTrend);
  const boundedTrendMultiplier = 1 + Math.max(Math.min(rawTrend / 100, 1), -0.5) * 0.5;
  const projectedDailyUnits = Math.max(recentAvg * boundedTrendMultiplier, 0);
  const projectedUnits = Math.round(projectedDailyUnits * options.horizonDays);
  const nonZeroDays = series.filter((point) => point.units > 0).length;
  const confidence = classifyForecastConfidence({
    totalObservedUnits,
    nonZeroDays,
  });
  const decisionSupport = buildForecastDecisionSupport({
    trendPct,
    confidence,
    projectedUnits,
    recentWindowUnits,
    previousWindowUnits,
  });

  const forecastStart =
    series.length > 0
      ? addDays(new Date(`${series[series.length - 1]!.date}T00:00:00.000Z`), 1)
      : startOfUtcDay(new Date());
  const forecast = Array.from({ length: options.horizonDays }, (_, index) => {
    const date = addDays(forecastStart, index);
    return {
      date: formatDateKey(date),
      units: Math.max(Math.round(projectedDailyUnits), 0),
    };
  });

  return {
    categoryId: input.categoryId,
    categoryName: input.categoryName,
    totalObservedUnits,
    avgDailyUnits,
    recentWindowUnits,
    previousWindowUnits,
    trendPct,
    projectedUnits,
    confidence,
    demandStatus: decisionSupport.demandStatus,
    riskLevel: decisionSupport.riskLevel,
    urgency: decisionSupport.urgency,
    safetyBufferUnits: decisionSupport.safetyBufferUnits,
    planningUnits: decisionSupport.planningUnits,
    narrative: decisionSupport.narrative,
    history: series,
    forecast,
  };
}

function summarizeInteractionWindow(events: InteractionRow[]) {
  const eventTypeBreakdown = createEventTypeCounter();
  const productCounts = new Map<string, number>();
  const users = new Set<string>();
  const sessions = new Set<string>();
  const actors = new Set<ActorKey>();

  for (const event of events) {
    const eventType = event.eventType as InteractionEventType;
    eventTypeBreakdown[eventType] += 1;
    productCounts.set(event.productId, (productCounts.get(event.productId) ?? 0) + 1);

    if (event.userId) {
      users.add(event.userId);
    }
    if (event.sessionId) {
      sessions.add(event.sessionId);
    }
    const actorKey = toActorKey(event);
    if (actorKey) {
      actors.add(actorKey);
    }
  }

  return {
    eventTypeBreakdown,
    productCounts,
    users,
    sessions,
    actors,
  };
}

function classifyForecastConfidence(input: {
  totalObservedUnits: number;
  nonZeroDays: number;
}): "high" | "medium" | "low" {
  if (input.nonZeroDays >= 12 && input.totalObservedUnits >= 25) {
    return "high";
  }
  if (input.nonZeroDays >= 7 && input.totalObservedUnits >= 10) {
    return "medium";
  }
  return "low";
}

function buildForecastDecisionSupport(input: {
  trendPct: number;
  confidence: "high" | "medium" | "low";
  projectedUnits: number;
  recentWindowUnits: number;
  previousWindowUnits: number;
}): Pick<
  CategoryDemandForecast,
  | "demandStatus"
  | "riskLevel"
  | "urgency"
  | "safetyBufferUnits"
  | "planningUnits"
  | "narrative"
> {
  const demandStatus =
    input.trendPct >= 15 ? "rising" : input.trendPct <= -10 ? "softening" : "stable";
  const confidenceBufferMultiplier =
    input.confidence === "high" ? 0.35 : input.confidence === "medium" ? 0.25 : 0.15;
  const volatilityBufferUnits = Math.max(
    Math.ceil((input.recentWindowUnits - input.previousWindowUnits) * 0.5),
    0
  );
  const safetyBufferUnits = Math.max(
    Math.ceil(input.projectedUnits * confidenceBufferMultiplier),
    volatilityBufferUnits
  );
  const planningUnits = input.projectedUnits + safetyBufferUnits;

  const riskLevel =
    demandStatus === "rising" && input.confidence !== "low"
      ? "high"
      : demandStatus === "softening" && input.confidence === "low"
        ? "medium"
        : Math.abs(input.trendPct) >= 10 || input.confidence === "low"
          ? "medium"
          : "low";

  const urgency =
    demandStatus === "rising" && input.confidence === "high"
      ? "urgent"
      : riskLevel === "medium" || planningUnits > input.recentWindowUnits
        ? "watch"
        : "stable";

  const narrative =
    demandStatus === "rising"
      ? `Demand is accelerating. Plan for about ${planningUnits} units including a ${safetyBufferUnits}-unit safety buffer.`
      : demandStatus === "softening"
        ? `Demand is softening. Hold planning closer to ${planningUnits} units and avoid over-ordering.`
        : `Demand is stable. Plan around ${planningUnits} units with a ${safetyBufferUnits}-unit buffer.`;

  return {
    demandStatus,
    riskLevel,
    urgency,
    safetyBufferUnits,
    planningUnits,
    narrative,
  };
}

function startOfUtcDay(input: Date): Date {
  return new Date(
    Date.UTC(input.getUTCFullYear(), input.getUTCMonth(), input.getUTCDate())
  );
}

function addDays(input: Date, days: number): Date {
  const next = new Date(input);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateKey(input: Date): string {
  return input.toISOString().slice(0, 10);
}
