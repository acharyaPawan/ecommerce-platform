import pino, { type Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export interface LoggerOptions {
  service: string;
  level?: LogLevel;
  base?: Record<string, unknown>;
  pretty?: boolean;
}

const resolvePretty = (pretty?: boolean): boolean => {
  if (typeof pretty === "boolean") {
    return pretty;
  }

  const envPretty = process.env.LOG_PRETTY;
  if (typeof envPretty === "string") {
    return ["1", "true", "yes", "on"].includes(envPretty.toLowerCase());
  }

  return process.env.NODE_ENV !== "production";
};

const createTransport = (pretty: boolean) =>
  pretty
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          singleLine: false,
          ignore: "pid,hostname",
        },
      }
    : undefined;

export const createLogger = ({ service, level, base, pretty }: LoggerOptions): Logger => {
  const transport = createTransport(resolvePretty(pretty));

  return pino({
    level: level ?? (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info",
    base: {
      service,
      env: process.env.NODE_ENV ?? "development",
      ...(base ?? {}),
    },
    transport,
  });
};
