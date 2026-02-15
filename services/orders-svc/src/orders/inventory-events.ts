import { z } from "zod";

export enum InventoryIntegrationEventType {
  StockReservedV1 = "inventory.stock.reserved.v1",
  StockReservationFailedV1 = "inventory.stock.reservation_failed.v1",
}

const inventoryEnvelopeSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  occurredAt: z.string().min(1),
  payload: z.record(z.unknown()),
  correlationId: z.string().optional(),
  causationId: z.string().optional(),
});

export const stockReservedEventSchema = inventoryEnvelopeSchema.extend({
  type: z.literal(InventoryIntegrationEventType.StockReservedV1),
  payload: z.object({
    orderId: z.string().min(1),
    items: z.array(
      z.object({
        sku: z.string().min(1),
        qty: z.number().int().positive(),
      })
    ),
    expiresAt: z.string().nullable().optional(),
  }),
});

export const stockReservationFailedEventSchema = inventoryEnvelopeSchema.extend({
  type: z.literal(InventoryIntegrationEventType.StockReservationFailedV1),
  payload: z.object({
    orderId: z.string().min(1),
    reason: z.enum(["INVALID_ITEMS", "INSUFFICIENT_STOCK"]),
    insufficientItems: z
      .array(
        z.object({
          sku: z.string().min(1),
          qty: z.number().int().positive(),
          available: z.number().int().nonnegative(),
        })
      )
      .optional(),
  }),
});

export type StockReservedEvent = z.infer<typeof stockReservedEventSchema>;
export type StockReservationFailedEvent = z.infer<typeof stockReservationFailedEventSchema>;
