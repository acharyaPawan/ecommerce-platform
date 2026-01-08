import pino from "pino";

const isPretty =
  process.env.LOG_PRETTY === "true" ||
  process.env.NODE_ENV !== "production";

const transport = isPretty
  ? pino.transport({
      target: "pino-pretty",
      options: {
        colorize: true,
        translateTime: "SYS:standard",
        singleLine: false,
      },
    })
  : undefined;

export const logger = pino(
  {
    level: process.env.LOG_LEVEL ?? "info",
    base: { service: "iam-svc" },
  },
  transport
);
