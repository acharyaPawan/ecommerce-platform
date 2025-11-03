FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --filter @ecommerce/gateway --prod
COPY . ./
RUN pnpm --filter @ecommerce/gateway build
CMD ["node", "services/gateway/dist/main.js"]
