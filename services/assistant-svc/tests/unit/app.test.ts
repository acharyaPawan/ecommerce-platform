import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Mastra } from "@mastra/core/mastra";
import { createAssistantRouter } from "../../src/routes/assistant.js";

describe("assistant router", () => {
  it("returns a generated admin answer", async () => {
    const generate = vi.fn(async () => ({
      text: "Churn risk is concentrated in two P1 customers.",
      toolCalls: [{ toolName: "customerChurnTool" }],
      toolResults: [{ highRiskCount: 2 }],
    }));

    const app = new Hono();
    app.route(
      "/api/assistant",
      createAssistantRouter({
        mastra: {
          getAgentById: () => ({ generate }),
        } as unknown as Mastra,
      })
    );

    const response = await app.request("/api/assistant/admin/query", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        message: "Who is most at risk of churn?",
      }),
    });

    expect(response.status).toBe(200);
    expect(generate).toHaveBeenCalledWith("Who is most at risk of churn?");

    const payload = await response.json() as {
      text: string;
      toolCalls: unknown[];
      toolResults: unknown[];
    };

    expect(payload.text).toContain("P1");
    expect(payload.toolCalls).toHaveLength(1);
    expect(payload.toolResults).toHaveLength(1);
  });

  it("validates missing messages", async () => {
    const app = new Hono();
    app.route(
      "/api/assistant",
      createAssistantRouter({
        mastra: {
          getAgentById: () => null,
        } as unknown as Mastra,
      })
    );

    const response = await app.request("/api/assistant/admin/query", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(422);
  });
});
