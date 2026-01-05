import pino, { type Logger as PinoLogger } from 'pino';

type LogLevel = 'fatal' | 'error' | 'warn' | 'info' | 'debug';

export type Logger = PinoLogger;

interface LoggerOptions {
  name: string;
  level: LogLevel;
  base?: Record<string, unknown>;
}

const createTransport = () => {
  if (process.env.NODE_ENV !== 'development') {
    return undefined;
  }

  return {
    target: 'pino-pretty',
    options: {
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  };
};

export const createLogger = ({ name, level, base }: LoggerOptions): Logger =>
  pino({
    name,
    level,
    base: {
      service: name,
      ...(base ?? {}),
    },
    transport: createTransport(),
  });
