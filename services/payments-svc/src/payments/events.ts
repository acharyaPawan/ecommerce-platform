import { randomUUID } from "node:crypto";

export enum PaymentEventType {
  PaymentAuthorizedV1 = "payments.payment_authorized.v1",
  PaymentFailedV1 = "payments.payment_failed.v1",
  PaymentCapturedV1 = "payments.payment_captured.v1",
}

export type PaymentAggregateType = "payment";

export type PaymentEnvelope<TType extends PaymentEventType, TPayload> = {
  id: string;
  type: TType;
  aggregateType: PaymentAggregateType;
  aggregateId: string;
  occurredAt: string;
  version: 1;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
};

export type PaymentAuthorizedV1 = PaymentEnvelope<
  PaymentEventType.PaymentAuthorizedV1,
  {
    paymentId: string;
    orderId: string;
    amountCents: number;
    currency: string;
  }
>;

export type PaymentFailedV1 = PaymentEnvelope<
  PaymentEventType.PaymentFailedV1,
  {
    paymentId: string;
    orderId: string;
    reason?: string | null;
    failedAt: string;
  }
>;

export type PaymentCapturedV1 = PaymentEnvelope<
  PaymentEventType.PaymentCapturedV1,
  {
    paymentId: string;
    orderId: string;
    capturedAt: string;
  }
>;

export type AnyPaymentEvent = PaymentAuthorizedV1 | PaymentFailedV1 | PaymentCapturedV1;

export function makePaymentEnvelope<TType extends PaymentEventType, TPayload>(args: {
  type: TType;
  aggregateId: string;
  payload: TPayload;
  correlationId?: string;
  causationId?: string;
}): PaymentEnvelope<TType, TPayload> {
  return {
    id: randomUUID(),
    type: args.type,
    aggregateType: "payment",
    aggregateId: args.aggregateId,
    occurredAt: new Date().toISOString(),
    version: 1,
    correlationId: args.correlationId,
    causationId: args.causationId,
    payload: args.payload,
  };
}
