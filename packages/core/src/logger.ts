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

type TransportOptions = NonNullable<Parameters<typeof pino>[0]["transport"]>;

const resolveOtelEnabled = (): boolean =>
  Boolean(
    process.env.OTEL_EXPORTER_OTLP_LOGS_ENDPOINT ??
      process.env.OTEL_EXPORTER_OTLP_ENDPOINT
  );

const createTransport = (
  pretty: boolean,
  service: string,
  env: string
): TransportOptions | undefined => {
  const otelEnabled = resolveOtelEnabled();

  if (!pretty && !otelEnabled) {
    return undefined;
  }

  const consoleTarget = pretty
    ? {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          singleLine: false,
          ignore: "pid,hostname",
        },
      }
    : {
        target: "pino/file",
        options: {
          destination: 1,
        },
      };

  if (!otelEnabled) {
    return consoleTarget;
  }

  return {
    targets: [
      consoleTarget,
      {
        target: "pino-opentelemetry-transport",
        options: {
          resourceAttributes: {
            "service.name": service,
            "deployment.environment": env,
          },
        },
      },
    ],
  };
};

export const createLogger = ({ service, level, base, pretty }: LoggerOptions): Logger => {
  const env = process.env.NODE_ENV ?? "development";
  const transport = createTransport(resolvePretty(pretty), service, env);

  return pino({
    level: level ?? (process.env.LOG_LEVEL as LogLevel | undefined) ?? "info",
    base: {
      service,
      env,
      ...(base ?? {}),
    },
    transport,
  });
};
