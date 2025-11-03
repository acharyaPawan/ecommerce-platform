FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --filter @ecommerce/cart-svc --prod
COPY . ./
RUN pnpm --filter @ecommerce/cart-svc build
CMD ["node", "services/cart-svc/dist/main.js"]
