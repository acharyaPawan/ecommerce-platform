import { Hono } from "hono";
import { z } from "zod";
import type { Mastra } from "@mastra/core/mastra";
import logger from "../logger.js";

const adminQuerySchema = z.object({
  message: z.string().min(1, "message is required"),
});

type AssistantRouterDeps = {
  mastra: Mastra;
};

export function createAssistantRouter({ mastra }: AssistantRouterDeps): Hono {
  const router = new Hono();

  router.post("/admin/query", async (c) => {
    let payload: unknown;

    try {
      payload = await c.req.json();
    } catch {
      return c.json({ error: "Invalid JSON payload" }, 400);
    }

    const parsed = adminQuerySchema.safeParse(payload);
    if (!parsed.success) {
      return c.json({ error: "Validation failed", details: parsed.error.flatten() }, 422);
    }

    const agent = mastra.getAgentById("admin-analytics-agent");
    if (!agent) {
      logger.error("assistant.admin.agent_missing");
      return c.json({ error: "Admin analytics agent is unavailable" }, 500);
    }

    const result = await agent.generate(parsed.data.message);

    return c.json({
      text: result.text,
      toolCalls: result.toolCalls ?? [],
      toolResults: result.toolResults ?? [],
    });
  });

  return router;
}
