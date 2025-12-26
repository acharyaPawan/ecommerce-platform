import { randomUUID } from "node:crypto";

export enum InventoryEventType {
  StockReservedV1 = "inventory.stock.reserved.v1",
  StockReservationFailedV1 = "inventory.stock.reservation_failed.v1",
  StockReservationReleasedV1 = "inventory.stock.reservation_released.v1",
  StockCommittedV1 = "inventory.stock.committed.v1",
  StockAdjustmentAppliedV1 = "inventory.stock.adjustment_applied.v1",
  StockReservationExpiredV1 = "inventory.stock.reservation_expired.v1",
}

export type InventoryAggregateType = "inventory" | "reservation" | "sku";

export type InventoryEnvelope<TType extends InventoryEventType, TPayload> = {
  id: string;
  type: TType;
  aggregateId: string;
  aggregateType: InventoryAggregateType;
  occurredAt: string;
  version: 1;
  correlationId?: string;
  causationId?: string;
  payload: TPayload;
};

export type ReservationItemPayload = {
  sku: string;
  qty: number;
};

export type ItemAvailabilityPayload = ReservationItemPayload & {
  available: number;
};

export type StockReservedV1 = InventoryEnvelope<
  InventoryEventType.StockReservedV1,
  {
    orderId: string;
    items: ReservationItemPayload[];
    expiresAt?: string | null;
  }
>;

export type StockReservationFailedV1 = InventoryEnvelope<
  InventoryEventType.StockReservationFailedV1,
  {
    orderId: string;
    reason: "INVALID_ITEMS" | "INSUFFICIENT_STOCK";
    insufficientItems?: ItemAvailabilityPayload[];
  }
>;

export type StockReservationReleasedV1 = InventoryEnvelope<
  InventoryEventType.StockReservationReleasedV1,
  {
    orderId: string;
    reason: string;
    items: ReservationItemPayload[];
  }
>;

export type StockCommittedV1 = InventoryEnvelope<
  InventoryEventType.StockCommittedV1,
  {
    orderId: string;
    items: ReservationItemPayload[];
  }
>;

export type StockAdjustmentAppliedV1 = InventoryEnvelope<
  InventoryEventType.StockAdjustmentAppliedV1,
  {
    sku: string;
    delta: number;
    onHand: number;
    reserved: number;
    available: number;
    reason: string;
    referenceId?: string;
  }
>;

export type StockReservationExpiredV1 = InventoryEnvelope<
  InventoryEventType.StockReservationExpiredV1,
  {
    orderId: string;
    items: ReservationItemPayload[];
    expiresAt: string;
  }
>;

export type AnyInventoryEvent =
  | StockReservedV1
  | StockReservationFailedV1
  | StockReservationReleasedV1
  | StockCommittedV1
  | StockAdjustmentAppliedV1
  | StockReservationExpiredV1;

export function makeInventoryEnvelope<TType extends InventoryEventType, TPayload>(args: {
  type: TType;
  aggregateId: string;
  aggregateType?: InventoryAggregateType;
  payload: TPayload;
  correlationId?: string;
  causationId?: string;
}): InventoryEnvelope<TType, TPayload> {
  return {
    id: randomUUID(),
    type: args.type,
    aggregateId: args.aggregateId,
    aggregateType: args.aggregateType ?? "inventory",
    occurredAt: new Date().toISOString(),
    version: 1,
    correlationId: args.correlationId,
    causationId: args.causationId,
    payload: args.payload,
  };
}
