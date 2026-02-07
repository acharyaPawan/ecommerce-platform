FROM node:20-alpine

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json tsconfig.base.json ./
COPY packages ./packages
COPY services/fulfillment-svc ./services/fulfillment-svc

RUN corepack enable && pnpm install --frozen-lockfile
RUN pnpm --filter @ecommerce/fulfillment-svc build

EXPOSE 3009

CMD ["pnpm", "--filter", "@ecommerce/fulfillment-svc", "start"]
