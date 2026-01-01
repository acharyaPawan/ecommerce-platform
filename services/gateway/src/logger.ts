type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug';

const levelWeights: Record<LogLevel, number> = {
  fatal: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
}

interface LoggerOptions {
  name: string;
  level: LogLevel;
  base?: Record<string, unknown>;
}

class ConsoleLogger implements Logger {
  private readonly weight: number;

  constructor(private readonly options: LoggerOptions) {
    this.weight = levelWeights[options.level];
  }

  info(message: string, meta?: Record<string, unknown>): void {
    this.write('info', message, meta);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    this.write('warn', message, meta);
  }

  error(message: string, meta?: Record<string, unknown>): void {
    this.write('error', message, meta);
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    this.write('debug', message, meta);
  }

  child(meta: Record<string, unknown>): Logger {
    const nextBase = { ...(this.options.base ?? {}), ...meta };
    return new ConsoleLogger({
      name: this.options.name,
      level: this.options.level,
      base: nextBase,
    });
  }

  private write(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
    if (levelWeights[level] > this.weight) {
      return;
    }

    const payload = {
      time: new Date().toISOString(),
      level,
      message,
      logger: this.options.name,
      ...this.options.base,
      ...(meta ?? {}),
    };

    const serialized = JSON.stringify(payload);

    if (level === 'error') {
      console.error(serialized);
    } else if (level === 'warn') {
      console.warn(serialized);
    } else if (level === 'debug') {
      console.debug(serialized);
    } else {
      console.log(serialized);
    }
  }
}

export const createLogger = (options: LoggerOptions): Logger => new ConsoleLogger(options);
