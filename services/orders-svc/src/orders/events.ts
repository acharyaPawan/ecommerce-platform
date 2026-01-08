import { randomUUID } from "node:crypto";

export enum OrderEventType {
  OrderPlacedV1 = "orders.order_placed.v1",
  OrderCanceledV1 = "orders.order_canceled.v1",
}

export type OrderAggregateType = "order";

export type OrderEnvelope<TType extends OrderEventType, TPayload> = {
  id: string;
  type: TType;
  aggregateType: OrderAggregateType;
  aggregateId: string;
  occurredAt: string;
  version: 1;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
};

export type OrderPlacedV1 = OrderEnvelope<
  OrderEventType.OrderPlacedV1,
  {
    orderId: string;
    items: Array<{ sku: string; qty: number }>;
    ttlSeconds?: number;
  }
>;

export type OrderCanceledV1 = OrderEnvelope<
  OrderEventType.OrderCanceledV1,
  {
    orderId: string;
    reason?: string | null;
    canceledAt: string;
  }
>;

export type AnyOrderEvent = OrderPlacedV1 | OrderCanceledV1;

export function makeOrderEnvelope<TType extends OrderEventType, TPayload>(args: {
  type: TType;
  aggregateId: string;
  payload: TPayload;
  correlationId?: string;
  causationId?: string;
}): OrderEnvelope<TType, TPayload> {
  return {
    id: randomUUID(),
    type: args.type,
    aggregateType: "order",
    aggregateId: args.aggregateId,
    occurredAt: new Date().toISOString(),
    version: 1,
    correlationId: args.correlationId,
    causationId: args.causationId,
    payload: args.payload,
  };
}
