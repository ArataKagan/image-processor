# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Run the full stack
```bash
docker compose up --build
```
First run only — apply the DB migration after containers are up:
```bash
DATABASE_URL="postgresql://imgproc:imgproc@localhost:5432/imgproc" \
  npx prisma migrate deploy --schema ./prisma/schema.prisma
```

### Tests
```bash
# Gateway (24 tests) — mocks all external deps
cd gateway && npm test

# Worker (8 tests) — uses real Sharp, mocks Prisma/MinIO
cd worker && npm test

# Single test file
cd gateway && npx jest src/__tests__/routes.test.ts
cd worker && npx jest src/__tests__/imageProcessor.test.ts
```

### TypeScript build
```bash
cd gateway && npm run build   # outputs to gateway/dist/
cd worker  && npm run build   # outputs to worker/dist/
```

### Prisma
```bash
# Regenerate client after schema changes (run from gateway/ or worker/)
npx prisma generate

# Create a new migration (requires running Postgres)
DATABASE_URL="..." npx prisma migrate dev --name <migration-name> --schema ../prisma/schema.prisma
```

## Architecture

Two independent Node.js services share a single Prisma schema (`prisma/schema.prisma`) and communicate only through Redis (BullMQ queue) and PostgreSQL. Neither service imports from the other.

### Gateway (`gateway/src/`)
Express API on port 4000. Handles the synchronous half of every request:
- Validates file type (multer) and task params (`validation/upload.ts`)
- Writes the original image to MinIO under `originals/<uuid>.<ext>`
- Creates a `Task` row in Postgres (status `PENDING`)
- Enqueues a BullMQ job on the `image-processing` queue
- Returns `{ taskId, status }` immediately — processing is async

### Worker (`worker/src/`)
BullMQ consumer (concurrency: 3). Handles the async half:
- Downloads the original from MinIO
- Applies the transform via Sharp (`services/imageProcessor.ts`)
- Uploads the result to MinIO under `processed/<uuid>.<ext>`
- Updates the `Task` row to `COMPLETED` or `FAILED`

### Queue contract
Job payload is typed as `JobPayload` in both `gateway/src/services/queue.ts` and `worker/src/processor.ts` — keep these in sync when adding task types.

### Data flow
```
POST /api/upload → MinIO (original) → Postgres (Task) → Redis (job)
                                                              ↓
                                              Worker → MinIO (processed) → Postgres (Task)
GET /api/tasks/:id   → Postgres (poll status)
GET /api/download/:id → MinIO (stream processed file)
```

### Frontend (`frontend/`)
Static HTML/JS served by nginx on port 3000. Nginx reverse-proxies `/api/*` to `gateway:4000`. No build step.

### Prisma schema location
The schema lives at the repo root (`prisma/schema.prisma`) and is shared by both services. Each service's `package.json` has `"prisma": { "schema": "../prisma/schema.prisma" }` to point Prisma CLI to it. Prisma client is generated into each service's own `node_modules`.

### Docker build context
Both `gateway/Dockerfile` and `worker/Dockerfile` use the repo root as build context (see `docker-compose.yml`). This is required so each Dockerfile can copy the shared `prisma/` directory alongside its own service directory.

### Error handling
Validation errors thrown by `validateUpload` (`Invalid task`, `Width and height`) are caught by `middleware/errorHandler.ts` and returned as 400. All other errors return 500. The tasks route wraps its handler in try/catch and calls `next(err)`.
