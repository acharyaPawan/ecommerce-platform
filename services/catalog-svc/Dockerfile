FROM node:20-alpine
WORKDIR /app

COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --filter @ecommerce/catalog-svc --prod

COPY . ./
RUN pnpm --filter @ecommerce/catalog-svc build

CMD ["node", "services/catalog-svc/dist/index.js"]
