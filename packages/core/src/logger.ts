import pino, { type Logger as PinoLogger } from "pino";

export type Logger = PinoLogger;
export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug" | "trace";

export interface LoggerOptions {
  service: string;
  level?: LogLevel;
  base?: Record<string, unknown>;
  pretty?: boolean;
}

const resolveLogLevel = (level?: LogLevel): LogLevel => {
  if (level) {
    return level;
  }

  const envLevel = process.env.LOG_LEVEL as LogLevel | undefined;
  if (envLevel) {
    return envLevel;
  }

  return process.env.NODE_ENV === "production" ? "info" : "trace";
};

const resolveTargetLevel = (envName: string, fallback: LogLevel): LogLevel => {
  const envLevel = process.env[envName] as LogLevel | undefined;
  return envLevel ?? fallback;
};

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
  env: string,
  baseLevel: LogLevel
): TransportOptions | undefined => {
  const otelEnabled = resolveOtelEnabled();
  const consoleLevel = resolveTargetLevel("LOG_CONSOLE_LEVEL", baseLevel);
  const otelLevel = resolveTargetLevel("LOG_OTEL_LEVEL", baseLevel);

  if (!pretty && !otelEnabled && consoleLevel === baseLevel) {
    return undefined;
  }

  const consoleTarget = pretty
    ? {
        target: "pino-pretty",
        level: consoleLevel,
        options: {
          colorize: true,
          translateTime: "SYS:standard",
          singleLine: false,
          ignore: "pid,hostname",
        },
      }
    : {
        target: "pino/file",
        level: consoleLevel,
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
        level: otelLevel,
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
  const resolvedLevel = resolveLogLevel(level);
  const transport = createTransport(resolvePretty(pretty), service, env, resolvedLevel);

  return pino({
    level: resolvedLevel,
    base: {
      service,
      env,
      ...(base ?? {}),
    },
    transport,
  });
};
