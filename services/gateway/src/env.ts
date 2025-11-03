export interface GatewayEnv {
  NODE_ENV: string;
  PORT?: string;
}

export function loadEnv(env: NodeJS.ProcessEnv): GatewayEnv {
  return {
    NODE_ENV: env.NODE_ENV ?? 'development',
    PORT: env.PORT
  };
}
