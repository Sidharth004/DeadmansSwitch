FROM node:20-bookworm-slim AS builder

WORKDIR /app

COPY agent/package*.json ./
RUN npm ci

COPY agent/tsconfig.json ./
COPY agent/src ./src

RUN npm run build

FROM node:20-bookworm-slim AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY agent/package*.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist

EXPOSE 8000

CMD ["node", "dist/main.js"]
