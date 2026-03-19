import { Hono } from "hono";
import type { Context } from "hono";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import {
  AuthorizationError,
  readBearerToken,
  resolveVerifyAuthTokenOptions,
  verifyAuthToken,
  type VerifiedAuthTokenPayload,
  type VerifyAuthTokenOptions,
} from "@ecommerce/core";
import { interactionEventIngestSchema } from "@ecommerce/events";
import type { AnalyticsServiceConfig } from "../config.js";
import logger from "../logger.js";
import {
  getRecommendationInspectionSnapshot,
  getPersonalProductRecommendations,
  getRelatedProductRecommendations,
  recordInteractionEvent,
  resolveInteractionActor,
  type RecordInteractionInput,
  type RecordedInteractionEvent,
  type RecommendationInspectionSnapshot,
} from "../analytics/service.js";

type AnalyticsRouterDeps = {
  config: AnalyticsServiceConfig;
  recordInteraction?: (input: RecordInteractionInput) => Promise<RecordedInteractionEvent>;
  getRecommendationInspection?: (input?: {
    lookbackDays?: number;
    sampleAnchorLimit?: number;
    recommendationLimit?: number;
  }) => Promise<RecommendationInspectionSnapshot>;
};

export const createAnalyticsRouter = ({
  config,
  recordInteraction = recordInteractionEvent,
  getRecommendationInspection = getRecommendationInspectionSnapshot,
}: AnalyticsRouterDeps): Hono => {
  const router = new Hono();
  const verifyOptions = resolveVerifyAuthTokenOptions(config.auth);
  const authenticateRequest = createRequestAuthenticator(verifyOptions);

  router.get("/recommendations/products/:productId/related", async (c) => {
    const productId = c.req.param("productId")?.trim();
    if (!productId) {
      return c.json({ error: "Product ID is required" }, 400);
    }

    const limitRaw = c.req.query("limit");
    const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
    const limit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.trunc(parsedLimit)
        : undefined;

    const items = await getRelatedProductRecommendations({
      productId,
      limit,
    });

    return c.json({ items });
  });

  router.get("/recommendations/for-you", async (c) => {
    const userId = c.req.query("userId")?.trim();
    const sessionId = c.req.query("sessionId")?.trim();
    const limitRaw = c.req.query("limit");
    const parsedLimit = limitRaw ? Number(limitRaw) : undefined;
    const limit =
      parsedLimit && Number.isFinite(parsedLimit) && parsedLimit > 0
        ? Math.trunc(parsedLimit)
        : undefined;

    const items = await getPersonalProductRecommendations({
      userId,
      sessionId,
      limit,
    });

    return c.json(items);
  });

  router.get("/recommendations/inspection", async (c) => {
    const lookbackDaysRaw = c.req.query("lookbackDays");
    const parsedLookbackDays = lookbackDaysRaw ? Number(lookbackDaysRaw) : undefined;
    const lookbackDays =
      parsedLookbackDays && Number.isFinite(parsedLookbackDays) && parsedLookbackDays > 0
        ? Math.trunc(parsedLookbackDays)
        : undefined;

    const sampleAnchorLimitRaw = c.req.query("sampleAnchorLimit");
    const parsedSampleAnchorLimit = sampleAnchorLimitRaw
      ? Number(sampleAnchorLimitRaw)
      : undefined;
    const sampleAnchorLimit =
      parsedSampleAnchorLimit &&
      Number.isFinite(parsedSampleAnchorLimit) &&
      parsedSampleAnchorLimit > 0
        ? Math.trunc(parsedSampleAnchorLimit)
        : undefined;

    const recommendationLimitRaw = c.req.query("recommendationLimit");
    const parsedRecommendationLimit = recommendationLimitRaw
      ? Number(recommendationLimitRaw)
      : undefined;
    const recommendationLimit =
      parsedRecommendationLimit &&
      Number.isFinite(parsedRecommendationLimit) &&
      parsedRecommendationLimit > 0
        ? Math.trunc(parsedRecommendationLimit)
        : undefined;

    const snapshot = await getRecommendationInspection({
      lookbackDays,
      sampleAnchorLimit,
      recommendationLimit,
    });

    return c.json(snapshot);
  });

  router.post("/interactions", async (c) => {
    let payload: unknown;

    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON payload" }, 400);
    }

    // optional: if you want to reject empty-object cases, keep an explicit check here
    const parsed = interactionEventIngestSchema.safeParse(payload);
    if (!parsed.success) {
      logger.warn({ errors: parsed.error.flatten() }, "analytics.interactions.validation_failed");
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const internalSecret = c.req.header("x-internal-service-secret")?.trim();
    const trustedInternalCall =
      !!internalSecret && internalSecret === config.internalServiceSecret;

    const authUser = trustedInternalCall
      ? null
      : await authenticateRequest(c.req.raw, { optional: true });

    let actor;
    try {
      actor = resolveInteractionActor(parsed.data, {
        authenticatedUserId: authUser?.userId,
        trustedInternalCall,
      });
    } catch (error) {
      logger.warn({ err: error }, "analytics.interactions.actor_resolution_failed");
      return c.json({ error: "forbidden" }, 403);
    }

    const effectiveEvent = interactionEventIngestSchema.safeParse({
      ...parsed.data,
      userId: actor.userId,
      sessionId: actor.sessionId,
    });
    if (!effectiveEvent.success) {
      return c.json(
        { error: "Validation failed", details: effectiveEvent.error.flatten() },
        422
      );
    }

    const ingestionKey = c.req.header("idempotency-key")?.trim();
    const result = await recordInteraction({
      eventType: effectiveEvent.data.eventType,
      source: effectiveEvent.data.source,
      productId: effectiveEvent.data.productId,
      variantId: effectiveEvent.data.variantId,
      userId: effectiveEvent.data.userId,
      sessionId: effectiveEvent.data.sessionId,
      occurredAt: effectiveEvent.data.occurredAt,
      properties: effectiveEvent.data.properties,
      ingestionKey,
    });

    c.header("x-idempotent-replay", result.idempotent ? "true" : "false");
    return c.json(
      {
        item: result,
      },
      (result.idempotent ? 200 : 201) as ContentfulStatusCode
    );
  });

  return router;
};

type JsonResult =
  | { success: true; data: unknown }
  | { success: false; error: "Invalid JSON payload" };

async function readJson(c: Context): Promise<JsonResult> {
  const raw = await c.req.text();
  if (!raw.trim()) {
    return { success: false, error: "Invalid JSON payload" };
  }

  try {
    return { success: true, data: JSON.parse(raw) as unknown };
  } catch {
    return { success: false, error: "Invalid JSON payload" };
  }
}

type RequestAuthenticator = (
  request: Request,
  options?: RequestAuthenticatorOptions
) => Promise<VerifiedAuthTokenPayload | null>;

type RequestAuthenticatorOptions = {
  optional?: boolean;
};

const createRequestAuthenticator = (options: VerifyAuthTokenOptions): RequestAuthenticator => {
  return async (request, authOptions = {}) => {
    const token = readBearerToken(request, { optional: authOptions.optional });
    if (!token) {
      return null;
    }

    try {
      return await verifyAuthToken(token, options);
    } catch (error) {
      if (authOptions.optional && error instanceof AuthorizationError) {
        return null;
      }
      throw error;
    }
  };
};
