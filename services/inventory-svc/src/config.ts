import { loadAuthConfig, type AuthConfig } from "@ecommerce/core";

export type ServiceConfig = {
  auth: AuthConfig;
};

export const loadConfig = (): ServiceConfig => ({
  auth: loadAuthConfig({
    deriveJwksFromIam: {
      iamUrl: process.env.IAM_SERVICE_URL,
    },
  }),
});
