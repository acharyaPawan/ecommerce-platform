import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createAuthMiddleware } from "better-auth/api";
import db from "./db/index.js";
import { iamOutboxEvents } from "./db/schema.js";
import {
  AnyIamEvent,
  IamEventType,
  makeIamEnvelope,
} from "./contracts/iam-events.js";

const SIGN_UP_EMAIL_PATH = "/sign-up/email";
const SIGN_IN_EMAIL_PATH = "/sign-in/email";
const EMAIL_VERIFICATION_PATH = "/verification/email";//To check with better

const persistOutboxEvent = async (event: AnyIamEvent) => {
  await db.insert(iamOutboxEvents).values({
    id: event.id,
    type: event.type,
    aggregateId: event.aggregateId,
    aggregateType: event.aggregateType,
    occurredAt: new Date(event.occurredAt),
    payload: event.payload,
    correlationId: event.correlationId ?? null,
    causationId: event.causationId ?? null,
    status: "pending",
    error: null,
  });
};

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
  }),
  hooks: {
    after: createAuthMiddleware(async (ctx) => {
      const newSession = ctx.context.newSession;
      if (!newSession) {
        return;
      }

      const correlationId = ctx.headers?.get("x-request-id") ?? undefined;
      const user = newSession.user as typeof newSession.user & {
        emailVerified?: boolean | null;
        name?: string | null;
      };

      if (ctx.path === SIGN_UP_EMAIL_PATH) {
        const envelope = makeIamEnvelope({
          type: IamEventType.UserRegisteredV1,
          aggregateId: user.id,
          correlationId,
          payload: {
            userId: user.id,
            email: user.email,
            name: user.name ?? null,
            emailVerified: Boolean(user.emailVerified),
          },
        });

        await persistOutboxEvent(envelope);
        return;
      }

      if (ctx.path === SIGN_IN_EMAIL_PATH) {
        const envelope = makeIamEnvelope({
          type: IamEventType.UserSignedInV1,
          aggregateId: user.id,
          correlationId,
          payload: {
            userId: user.id,
            occurredAt: new Date().toISOString(),
          },
        });

        await persistOutboxEvent(envelope);
        return;
      }

      if (ctx.path === EMAIL_VERIFICATION_PATH) {
        const envelope = makeIamEnvelope({
          type: IamEventType.UserEmailVerifiedV1,
          aggregateId: user.id,
          correlationId,
          payload: {
            userId: user.id,
            verifiedAt: new Date().toISOString(),
          },
        });

        await persistOutboxEvent(envelope);
      }
    }),
  },
});
