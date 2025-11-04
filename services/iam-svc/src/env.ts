export interface ServiceEnv {
  NODE_ENV: string;
  PORT?: string;
  DATABASE_URL?: string;
  AUTH_URL?: string;
  BETTER_AUTH_SECRET?: string;
}

export function loadEnv(env: NodeJS.ProcessEnv): ServiceEnv {
  return {
    NODE_ENV: env.NODE_ENV ?? 'development',
    PORT: env.PORT,
    DATABASE_URL: env.DATABASE_URL,
    AUTH_URL: env.AUTH_URL,
    BETTER_AUTH_SECRET: env.BETTER_AUTH_SECRET
  };
}
