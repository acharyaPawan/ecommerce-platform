import type { FulfillmentServiceConfig } from "../config.js";
import type { ShipmentView, ShippingOption } from "./types.js";

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

  getShipment(orderId: string): ShipmentView {
    const normalizedOrderId = orderId.trim();
    return this.buildShipment(normalizedOrderId);
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
