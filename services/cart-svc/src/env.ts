export interface ServiceEnv {
  NODE_ENV: string;
  PORT?: string;
  DATABASE_URL?: string;
}

export function loadEnv(env: NodeJS.ProcessEnv): ServiceEnv {
  return {
    NODE_ENV: env.NODE_ENV ?? 'development',
    PORT: env.PORT,
    DATABASE_URL: env.DATABASE_URL
  };
}
