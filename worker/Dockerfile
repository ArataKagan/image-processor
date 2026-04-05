FROM node:22-alpine AS builder
WORKDIR /app
COPY prisma/ ./prisma/
COPY worker/package*.json ./worker/
RUN apk add --no-cache python3 make g++
RUN cd worker && npm ci
RUN cd worker && npx prisma generate
COPY worker/ ./worker/
RUN cd worker && npm run build

FROM node:22-alpine
WORKDIR /app
COPY prisma/ ./prisma/
COPY --from=builder /app/worker/package*.json ./worker/
RUN apk add --no-cache python3 make g++
RUN cd worker && npm ci --omit=dev
RUN cd worker && npx prisma generate
COPY --from=builder /app/worker/dist/ ./worker/dist/
WORKDIR /app/worker
CMD ["node", "dist/index.js"]
