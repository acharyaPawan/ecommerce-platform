import { describe, expect, it } from "vitest";
import { createApp } from "../../src/app.js";
import type { FulfillmentServiceConfig } from "../../src/config.js";

const TEST_CONFIG: FulfillmentServiceConfig = {
  serviceName: "fulfillment-svc",
  port: 3009,
  defaultCurrency: "USD",
  defaultCountry: "US",
  auth: {
    issuer: "iam-svc",
    audience: "ecommerce-clients",
    devUserHeader: "x-user-id",
  },
};

describe("fulfillment-svc", () => {
  it("returns shipping options successfully", async () => {
    const app = createApp({ config: TEST_CONFIG });
    const response = await app.request("/api/fulfillment/shipping/options?country=US&postalCode=10001");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.country).toBe("US");
    expect(payload.postalCode).toBe("10001");
    expect(payload.options).toHaveLength(2);
    expect(payload.options[0].serviceLevel).toBe("standard");
    expect(payload.options[1].serviceLevel).toBe("express");
  });

  it("returns fulfilled shipment for any order", async () => {
    const app = createApp({ config: TEST_CONFIG });
    const response = await app.request("/api/fulfillment/shipments?orderId=ord_12345");
    expect(response.status).toBe(200);

    const payload = await response.json();
    expect(payload.orderId).toBe("ord_12345");
    expect(payload.status).toBe("fulfilled");
    expect(typeof payload.shipmentId).toBe("string");
    expect(typeof payload.trackingNumber).toBe("string");
    expect(typeof payload.trackingUrl).toBe("string");
  });

  it("creates a fulfilled shipment for incoming requests", async () => {
    const app = createApp({ config: TEST_CONFIG });
    const response = await app.request("/api/fulfillment/shipments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ orderId: "ord_incoming_1" }),
    });
    expect(response.status).toBe(201);

    const payload = await response.json();
    expect(payload.shipment.orderId).toBe("ord_incoming_1");
    expect(payload.shipment.status).toBe("fulfilled");
  });
});
