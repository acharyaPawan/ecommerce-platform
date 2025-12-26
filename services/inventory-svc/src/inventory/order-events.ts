import { eventEnvelope } from "@ecommerce/events";
import { z } from "zod";

export enum OrderIntegrationEventType {
  OrderPlacedV1 = "orders.order_placed.v1",
  PaymentAuthorizedV1 = "payments.payment_authorized.v1",
  OrderCanceledV1 = "orders.order_canceled.v1",
  PaymentFailedV1 = "payments.payment_failed.v1",
}

const orderItemSchema = z.object({
  sku: z.string().min(1),
  qty: z.number().int().positive(),
});

export const orderPlacedPayloadSchema = z.object({
  orderId: z.string(),
  items: z.array(orderItemSchema).min(1),
  ttlSeconds: z.number().int().positive().optional(),
});

export const paymentAuthorizedPayloadSchema = z.object({
  orderId: z.string(),
});

export const orderCanceledPayloadSchema = z.object({
  orderId: z.string(),
  reason: z.string().optional(),
});

export const paymentFailedPayloadSchema = z.object({
  orderId: z.string(),
  reason: z.string().optional(),
});

export const orderPlacedEventSchema = eventEnvelope(orderPlacedPayloadSchema).extend({
  type: z.literal(OrderIntegrationEventType.OrderPlacedV1),
});

export const paymentAuthorizedEventSchema = eventEnvelope(paymentAuthorizedPayloadSchema).extend({
  type: z.literal(OrderIntegrationEventType.PaymentAuthorizedV1),
});

export const orderCanceledEventSchema = eventEnvelope(orderCanceledPayloadSchema).extend({
  type: z.literal(OrderIntegrationEventType.OrderCanceledV1),
});

export const paymentFailedEventSchema = eventEnvelope(paymentFailedPayloadSchema).extend({
  type: z.literal(OrderIntegrationEventType.PaymentFailedV1),
});

export type OrderPlacedEvent = z.infer<typeof orderPlacedEventSchema>;
export type PaymentAuthorizedEvent = z.infer<typeof paymentAuthorizedEventSchema>;
export type OrderCanceledEvent = z.infer<typeof orderCanceledEventSchema>;
export type PaymentFailedEvent = z.infer<typeof paymentFailedEventSchema>;

export type SupportedOrderEvent =
  | OrderPlacedEvent
  | PaymentAuthorizedEvent
  | OrderCanceledEvent
  | PaymentFailedEvent;
