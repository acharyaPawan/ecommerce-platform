import { createLogger as createCoreLogger, type Logger, type LogLevel } from "@ecommerce/core";

interface LoggerOptions {
  name: string;
  level: LogLevel;
  base?: Record<string, unknown>;
}

export type { Logger, LogLevel };

export const createLogger = ({ name, level, base }: LoggerOptions): Logger =>
  createCoreLogger({
    service: name,
    level,
    base,
  });
