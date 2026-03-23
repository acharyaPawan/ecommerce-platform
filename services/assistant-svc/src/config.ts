import { z } from "zod";

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(3011),
  ASSISTANT_SVC_PORT: z.coerce.number().int().positive().optional(),
  ASSISTANT_SERVICE_NAME: z.string().min(1).default("assistant-svc"),
  ASSISTANT_MODEL: z.string().min(1).default("openai/gpt-4.1-mini"),
  OPENAI_API_KEY: z.string().min(1, "OPENAI_API_KEY is required"),
  ANALYTICS_SERVICE_URL: z.string().url().default("http://localhost:3010"),
  INTERNAL_SERVICE_SECRET: z.string().min(1).default("dev-internal-secret"),
});

export type AssistantServiceConfig = {
  port: number;
  serviceName: string;
  assistantModel: string;
  openAiApiKey: string;
  analyticsServiceUrl: string;
  internalServiceSecret: string;
};

export function loadConfig(env: NodeJS.ProcessEnv = process.env): AssistantServiceConfig {
  const parsed = envSchema.parse(env);

  return {
    port: parsed.ASSISTANT_SVC_PORT ?? parsed.PORT,
    serviceName: parsed.ASSISTANT_SERVICE_NAME,
    assistantModel: parsed.ASSISTANT_MODEL,
    openAiApiKey: parsed.OPENAI_API_KEY,
    analyticsServiceUrl: parsed.ANALYTICS_SERVICE_URL.replace(/\/+$/, ""),
    internalServiceSecret: parsed.INTERNAL_SERVICE_SECRET,
  };
}
