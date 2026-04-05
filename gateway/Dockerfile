FROM node:22-alpine AS builder
WORKDIR /app
COPY prisma/ ./prisma/
COPY gateway/package*.json ./gateway/
RUN cd gateway && npm ci
RUN cd gateway && npx prisma generate
COPY gateway/ ./gateway/
RUN cd gateway && npm run build

FROM node:22-alpine
WORKDIR /app
COPY prisma/ ./prisma/
COPY --from=builder /app/gateway/package*.json ./gateway/
RUN cd gateway && npm ci --omit=dev
RUN cd gateway && npx prisma generate
COPY --from=builder /app/gateway/dist/ ./gateway/dist/
WORKDIR /app/gateway
CMD ["node", "dist/index.js"]
