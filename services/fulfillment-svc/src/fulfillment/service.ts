import type { FulfillmentServiceConfig } from "../config.js";
import db from "../db/index.js";
import { shipments } from "../db/schema.js";
import type { ShipmentView, ShippingOption } from "./types.js";
import { eq } from "drizzle-orm";

const STANDARD_DELIVERY_DAYS = 5;
const EXPRESS_DELIVERY_DAYS = 2;

export class FulfillmentService {
  constructor(private readonly config: FulfillmentServiceConfig) {}

  getShippingOptions(input: { country?: string; postalCode?: string }): {
    country: string;
    postalCode: string | null;
    options: ShippingOption[];
  } {
    const country = normalizeCountry(input.country, this.config.defaultCountry);
    const postalCode = normalizePostalCode(input.postalCode);

    return {
      country,
      postalCode,
      options: [
        {
          id: "ground-standard",
          label: "Standard Shipping",
          carrier: "ACME Logistics",
          serviceLevel: "standard",
          amount: 799,
          currency: this.config.defaultCurrency,
          estimatedDeliveryDays: STANDARD_DELIVERY_DAYS,
        },
        {
          id: "priority-express",
          label: "Express Shipping",
          carrier: "ACME Logistics",
          serviceLevel: "express",
          amount: 1999,
          currency: this.config.defaultCurrency,
          estimatedDeliveryDays: EXPRESS_DELIVERY_DAYS,
        },
      ],
    };
  }

  async getShipment(orderId: string): Promise<ShipmentView | null> {
    const normalizedOrderId = orderId.trim();
    const [shipment] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, normalizedOrderId))
      .limit(1);
    return shipment ? mapShipment(shipment) : null;
  }

  async createShipment(orderId: string): Promise<ShipmentView> {
    const normalizedOrderId = orderId.trim();
    const [existing] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, normalizedOrderId))
      .limit(1);
    if (existing) {
      return mapShipment(existing);
    }

    const created = this.buildShipment(normalizedOrderId);
    const now = new Date();

    const [inserted] = await db
      .insert(shipments)
      .values({
        id: created.shipmentId,
        orderId: created.orderId,
        status: created.status,
        carrier: created.carrier,
        trackingNumber: created.trackingNumber,
        trackingUrl: created.trackingUrl,
        shippedAt: new Date(created.shippedAt),
        deliveredAt: new Date(created.deliveredAt),
        createdAt: now,
        updatedAt: now,
      })
      .onConflictDoNothing({ target: [shipments.orderId] })
      .returning();

    if (inserted) {
      return mapShipment(inserted);
    }

    const [conflictExisting] = await db
      .select()
      .from(shipments)
      .where(eq(shipments.orderId, normalizedOrderId))
      .limit(1);
    if (conflictExisting) {
      return mapShipment(conflictExisting);
    }

    return created;
  }

  private buildShipment(orderId: string): ShipmentView {
    const now = new Date();
    const shippedAt = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const deliveredAt = new Date(now.getTime() - 30 * 60 * 1000);
    const trackingToken = shortHash(orderId);
    const shipmentId = `shp_${trackingToken}`;
    const trackingNumber = `TRK-${trackingToken.toUpperCase()}`;

    return {
      shipmentId,
      orderId,
      status: "fulfilled",
      carrier: "ACME Logistics",
      trackingNumber,
      trackingUrl: `https://tracking.example.com/${trackingNumber}`,
      shippedAt: shippedAt.toISOString(),
      deliveredAt: deliveredAt.toISOString(),
    };
  }
}

type ShipmentRow = typeof shipments.$inferSelect;

function mapShipment(record: ShipmentRow): ShipmentView {
  return {
    shipmentId: record.id,
    orderId: record.orderId,
    status: "fulfilled",
    carrier: record.carrier,
    trackingNumber: record.trackingNumber,
    trackingUrl: record.trackingUrl,
    shippedAt: record.shippedAt.toISOString(),
    deliveredAt: record.deliveredAt.toISOString(),
  };
}

function normalizeCountry(country: string | undefined, fallback: string): string {
  const normalized = country?.trim().toUpperCase();
  if (!normalized) {
    return fallback;
  }
  return normalized;
}

function normalizePostalCode(postalCode: string | undefined): string | null {
  const normalized = postalCode?.trim();
  return normalized ? normalized : null;
}

function shortHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash +=
      (hash << 1) +
      (hash << 4) +
      (hash << 7) +
      (hash << 8) +
      (hash << 24);
  }
  return Math.abs(hash >>> 0).toString(16).padStart(8, "0");
}
