FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --filter @ecommerce/inventory-svc --prod
COPY . ./
RUN pnpm --filter @ecommerce/inventory-svc build
CMD ["node", "services/inventory-svc/dist/main.js"]
