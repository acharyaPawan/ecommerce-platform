FROM node:20-alpine
WORKDIR /app
COPY package.json pnpm-lock.yaml* ./
RUN corepack enable && pnpm install --filter @ecommerce/iam-svc --prod
COPY . ./
RUN pnpm --filter @ecommerce/iam-svc build
CMD ["node", "services/iam-svc/dist/main.js"]
