import { createApp } from "../../src/app.js";
const TEST_CONFIG = {
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
    it("returns not found when shipment has not been created", async () => {
        const app = createApp({ config: TEST_CONFIG });
        const response = await app.request("/api/fulfillment/shipments?orderId=ord_12345");
        expect(response.status).toBe(404);
    });
});
