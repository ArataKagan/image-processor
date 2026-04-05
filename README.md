# Image Processor

A production-grade, distributed image processing pipeline built with a microservices architecture. Upload an image, choose a transformation, and get back the processed result — all handled asynchronously with real-time status updates.

![Architecture](https://img.shields.io/badge/Architecture-Microservices-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-22-339933?logo=node.js)
![Docker](https://img.shields.io/badge/Docker-Compose-2496ED?logo=docker)
![License](https://img.shields.io/badge/License-MIT-green)

---

## Features

- **Async image processing** — jobs are queued and processed independently from the HTTP request lifecycle
- **Resize** — downscale images to any target dimension while preserving aspect ratio
- **Grayscale** — convert colour images to grayscale
- **Real-time status polling** — the frontend polls for job completion and surfaces a download link automatically
- **Fault tolerance** — failed jobs are retried up to 3 times with exponential backoff; errors are recorded per task
- **File validation** — JPEG, PNG, and WebP accepted; max 10 MB enforced at the gateway
- **Concurrent workers** — up to 3 jobs processed in parallel
- **Fully containerised** — one command brings up the entire stack

---

## Tech Stack

### Backend
| Layer | Technology | Purpose |
|---|---|---|
| API Gateway | **Node.js + Express** | HTTP API, file ingestion, request validation |
| Job Queue | **BullMQ + Redis** | Durable async job queue with retries & backoff |
| Worker | **Node.js + BullMQ** | Consumes jobs, applies image transforms |
| Image Processing | **Sharp** | High-performance image manipulation (libvips) |
| Database | **PostgreSQL + Prisma** | Task lifecycle tracking with typed ORM |
| Object Storage | **MinIO** | S3-compatible storage for original and processed images |

### Frontend
| Technology | Purpose |
|---|---|
| **Vanilla HTML/JS** | Lightweight single-page app — no framework overhead |
| **Nginx** | Static file serving + reverse proxy to the gateway |

### Infrastructure
| Technology | Purpose |
|---|---|
| **Docker + Docker Compose** | Single-command local orchestration of all 6 services |

### Testing
| Technology | Purpose |
|---|---|
| **Jest + ts-jest** | Unit and integration test runner |
| **Supertest** | HTTP integration testing for Express routes |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         Browser                                  │
│                    http://localhost:3000                         │
└───────────────────────────┬─────────────────────────────────────┘
                            │ HTTP
                    ┌───────▼────────┐
                    │    Frontend    │  Nginx (port 80)
                    │  (HTML + JS)   │  Reverse proxies /api → gateway
                    └───────┬────────┘
                            │ proxy /api/*
                    ┌───────▼────────┐
                    │    Gateway     │  Express (port 4000)
                    │  (REST API)    │
                    └──┬──────┬──────┘
                       │      │
           ┌───────────▼──┐ ┌─▼──────────┐
           │  PostgreSQL  │ │   MinIO     │
           │  (Tasks DB)  │ │  (Images)   │
           └──────────────┘ └─────────────┘
                       │
               ┌───────▼────────┐
               │  Redis / BullMQ│  Job Queue
               └───────┬────────┘
                       │ dequeue
                ┌──────▼───────┐
                │    Worker    │  BullMQ consumer (concurrency: 3)
                │  (Sharp)     │
                └──┬───────────┘
                   │  write processed image
           ┌───────▼──────────────┐
           │       MinIO          │
           │  processed/<id>.ext  │
           └──────────────────────┘
```

### Request Lifecycle

```
1. POST /api/upload  (multipart: image file + task params)
      → Validate file type & task params
      → Store original in MinIO  (originals/<uuid>.ext)
      → Create Task record in Postgres  (status: PENDING)
      → Enqueue BullMQ job
      ← 201 { taskId, status: "PENDING" }

2. Worker picks up job
      → Mark task PROCESSING
      → Download original from MinIO
      → Apply transformation (Sharp)
      → Upload result to MinIO  (processed/<uuid>.ext)
      → Mark task COMPLETED (or FAILED with errorMessage)

3. GET /api/tasks/:id      ← poll for status
4. GET /api/download/:id   ← stream processed image when COMPLETED
```

---

## Project Structure

```
imageProcessor/
├── gateway/                  # Express API service
│   ├── src/
│   │   ├── routes/           # upload.ts · tasks.ts · download.ts
│   │   ├── services/         # prisma.ts · minio.ts · queue.ts
│   │   ├── middleware/        # multer.ts · errorHandler.ts
│   │   ├── validation/        # upload.ts
│   │   └── __tests__/         # 24 Jest tests
│   └── Dockerfile
├── worker/                   # BullMQ consumer service
│   ├── src/
│   │   ├── services/         # imageProcessor.ts · minio.ts · prisma.ts
│   │   ├── processor.ts      # core job handler
│   │   └── __tests__/         # 8 Jest tests
│   └── Dockerfile
├── frontend/                 # Static SPA
│   ├── index.html
│   ├── nginx.conf
│   └── Dockerfile
├── prisma/
│   ├── schema.prisma         # Task model & enums
│   └── migrations/           # SQL migration history
├── docker-compose.yml        # Full stack orchestration
└── .env.example              # Environment variable reference
```

---

## Getting Started

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (includes Docker Compose)

That's it. No local Node.js installation required.

### Run the app

```bash
# Clone the repo
git clone <repo-url>
cd imageProcessor

# Start all services (builds images on first run)
docker compose up --build
```

Wait for the build to complete (~2 min on first run), then apply the database migration:

```bash
# In a separate terminal — only needed once
DATABASE_URL="postgresql://imgproc:imgproc@localhost:5432/imgproc" \
  npx prisma migrate deploy --schema ./prisma/schema.prisma
```

### Open the app

| Service | URL |
|---|---|
| **Web UI** | http://localhost:3000 |
| **API** | http://localhost:4000/api |
| **MinIO Console** | http://localhost:9001 |

MinIO credentials: `minioadmin` / `minioadmin`

### Stop the app

```bash
docker compose down          # stop containers
docker compose down -v       # stop + delete volumes (wipes DB & stored images)
```

---

## API Reference

### `POST /api/upload`

Upload an image and queue a processing job.

**Content-Type:** `multipart/form-data`

| Field | Type | Required | Description |
|---|---|---|---|
| `image` | file | Yes | JPEG, PNG, or WebP — max 10 MB |
| `task` | string | Yes | `grayscale` or `resize` |
| `width` | number | resize only | Target width in px (1–10000) |
| `height` | number | resize only | Target height in px (1–10000) |

**Response `201`**
```json
{ "taskId": "uuid", "status": "PENDING" }
```

---

### `GET /api/tasks/:id`

Poll for task status.

**Response `200`**
```json
{
  "id": "uuid",
  "status": "PENDING | PROCESSING | COMPLETED | FAILED",
  "taskType": "GRAYSCALE | RESIZE",
  "params": { "width": 800, "height": 600 },
  "originalKey": "originals/uuid.jpg",
  "processedKey": "processed/uuid.jpg",
  "errorMessage": null,
  "createdAt": "2026-04-05T00:00:00.000Z",
  "updatedAt": "2026-04-05T00:00:00.000Z"
}
```

---

### `GET /api/download/:id`

Download the processed image. Only available when `status === "COMPLETED"`.

**Response `200`** — binary image stream with `Content-Disposition: attachment`

---

### `GET /api/health`

```json
{ "status": "ok" }
```

---

## Running Tests

Tests are split between the two services. No external services (database, Redis, MinIO) are required — all dependencies are mocked.

```bash
# Gateway tests (24 tests)
cd gateway && npm test

# Worker tests (8 tests)
cd worker && npm test
```

### Test coverage

| Suite | Tests | What's covered |
|---|---|---|
| `gateway/validation.test.ts` | 7 | All valid/invalid inputs to `validateUpload` |
| `gateway/errorHandler.test.ts` | 5 | Every error branch — MulterError, 400s, 500 |
| `gateway/routes.test.ts` | 12 | Upload, task polling, and download routes end-to-end (Prisma, MinIO, BullMQ mocked) |
| `worker/imageProcessor.test.ts` | 4 | `resizeImage` and `grayscaleImage` with real Sharp |
| `worker/processor.test.ts` | 3 | Full `processJob` flow — GRAYSCALE, RESIZE, and failure path |

---

## Environment Variables

Copy `.env.example` to `.env` for local development outside Docker:

```bash
cp .env.example .env
```

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `postgresql://imgproc:imgproc@localhost:5432/imgproc` | Postgres connection string |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `MINIO_ENDPOINT` | `localhost` | MinIO host |
| `MINIO_PORT` | `9000` | MinIO port |
| `MINIO_ACCESS_KEY` | `minioadmin` | MinIO access key |
| `MINIO_SECRET_KEY` | `minioadmin` | MinIO secret key |
| `MINIO_BUCKET` | `images` | Storage bucket name |
| `PORT` | `4000` | Gateway HTTP port |

---

## Data Model

```prisma
model Task {
  id           String     @id @default(uuid())
  status       TaskStatus @default(PENDING)   // PENDING | PROCESSING | COMPLETED | FAILED
  taskType     TaskType                        // RESIZE | GRAYSCALE
  params       Json?                           // { width, height } for RESIZE
  originalKey  String                          // MinIO object key
  processedKey String?                         // set on COMPLETED
  mimeType     String
  errorMessage String?                         // set on FAILED
  createdAt    DateTime   @default(now())
  updatedAt    DateTime   @updatedAt
}
```

---

## Design Decisions

**Why BullMQ?**  
Image processing is CPU-bound and can be slow. Decoupling it from the HTTP layer via a queue means the gateway stays responsive, jobs survive service restarts, and horizontal scaling of workers is trivial.

**Why MinIO?**  
S3-compatible API means the same code works in local dev (MinIO) and production (AWS S3, GCS, etc.) with only an environment variable change.

**Why Prisma?**  
Type-safe database access with auto-generated migrations. The `Task` model serves as a single source of truth for job state, making the system resilient to worker crashes — any in-flight job can be recovered by re-queuing its `PROCESSING` tasks on startup.

**Why no frontend framework?**  
The UI is three interactions: upload, poll, download. A full React/Vue app would add build complexity for zero user benefit at this scope.
