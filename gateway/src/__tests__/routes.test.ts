import express from "express";
import request from "supertest";
import path from "path";

// --- Mocks (must be before imports that use them) ---

const mockPrismaCreate = jest.fn();
const mockPrismaFindUnique = jest.fn();

jest.mock("../services/prisma", () => ({
  prisma: {
    task: {
      create: (...args: unknown[]) => mockPrismaCreate(...args),
      findUnique: (...args: unknown[]) => mockPrismaFindUnique(...args),
    },
  },
}));

const mockUploadFile = jest.fn().mockResolvedValue(undefined);
const mockGetFileStream = jest.fn();

jest.mock("../services/minio", () => ({
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
  getFileStream: (...args: unknown[]) => mockGetFileStream(...args),
}));

const mockQueueAdd = jest.fn().mockResolvedValue(undefined);

jest.mock("../services/queue", () => ({
  imageQueue: { add: (...args: unknown[]) => mockQueueAdd(...args) },
}));

// --- App setup ---

import uploadRouter from "../routes/upload";
import tasksRouter from "../routes/tasks";
import downloadRouter from "../routes/download";
import { errorHandler } from "../middleware/errorHandler";

const app = express();
app.use(express.json());
app.use("/api/upload", uploadRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/download", downloadRouter);
app.use(errorHandler);

// --- Fixtures ---

const sampleTask = {
  id: "test-uuid",
  status: "PENDING",
  taskType: "GRAYSCALE",
  params: null,
  originalKey: "originals/test-uuid.jpg",
  processedKey: null,
  mimeType: "image/jpeg",
  errorMessage: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const sampleImagePath = path.join(__dirname, "fixtures", "sample.jpg");

// --- Tests ---

describe("POST /api/upload", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPrismaCreate.mockResolvedValue(sampleTask);
  });

  it("returns 400 when no file is attached", async () => {
    const res = await request(app)
      .post("/api/upload")
      .field("task", "grayscale");
    expect(res.status).toBe(400);
  });

  it("returns 400 for unsupported file type", async () => {
    const res = await request(app)
      .post("/api/upload")
      .attach("image", Buffer.from("fake"), { filename: "test.gif", contentType: "image/gif" })
      .field("task", "grayscale");
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid task type", async () => {
    const res = await request(app)
      .post("/api/upload")
      .attach("image", Buffer.from("fake"), { filename: "test.jpg", contentType: "image/jpeg" })
      .field("task", "blur");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Invalid task/);
  });

  it("returns 400 for RESIZE without dimensions", async () => {
    const res = await request(app)
      .post("/api/upload")
      .attach("image", Buffer.from("fake"), { filename: "test.jpg", contentType: "image/jpeg" })
      .field("task", "resize");
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Width and height/);
  });

  it("creates task and enqueues job for GRAYSCALE", async () => {
    const res = await request(app)
      .post("/api/upload")
      .attach("image", Buffer.from("fake"), { filename: "test.jpg", contentType: "image/jpeg" })
      .field("task", "grayscale");

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ taskId: "test-uuid", status: "PENDING" });
    expect(mockUploadFile).toHaveBeenCalledTimes(1);
    expect(mockPrismaCreate).toHaveBeenCalledTimes(1);
    expect(mockQueueAdd).toHaveBeenCalledTimes(1);
  });

  it("creates task and enqueues job for RESIZE with dimensions", async () => {
    mockPrismaCreate.mockResolvedValue({ ...sampleTask, taskType: "RESIZE", params: { width: 800, height: 600 } });

    const res = await request(app)
      .post("/api/upload")
      .attach("image", Buffer.from("fake"), { filename: "test.png", contentType: "image/png" })
      .field("task", "resize")
      .field("width", "800")
      .field("height", "600");

    expect(res.status).toBe(201);
    expect(mockQueueAdd).toHaveBeenCalledWith(
      "process-image",
      expect.objectContaining({ taskType: "RESIZE", params: { width: 800, height: 600 } })
    );
  });
});

describe("GET /api/tasks/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 for unknown task", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/tasks/nonexistent");
    expect(res.status).toBe(404);
  });

  it("returns task details for known id", async () => {
    mockPrismaFindUnique.mockResolvedValue(sampleTask);
    const res = await request(app).get("/api/tasks/test-uuid");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ id: "test-uuid", status: "PENDING" });
  });

  it("returns 500 when prisma throws", async () => {
    mockPrismaFindUnique.mockRejectedValue(new Error("db error"));
    const res = await request(app).get("/api/tasks/test-uuid");
    expect(res.status).toBe(500);
  });
});

describe("GET /api/download/:id", () => {
  beforeEach(() => jest.clearAllMocks());

  it("returns 404 when task not found", async () => {
    mockPrismaFindUnique.mockResolvedValue(null);
    const res = await request(app).get("/api/download/test-uuid");
    expect(res.status).toBe(404);
  });

  it("returns 404 when task is not COMPLETED", async () => {
    mockPrismaFindUnique.mockResolvedValue({ ...sampleTask, status: "PROCESSING" });
    const res = await request(app).get("/api/download/test-uuid");
    expect(res.status).toBe(404);
  });

  it("streams file when task is COMPLETED", async () => {
    const { Readable } = require("stream");
    const fakeStream = Readable.from([Buffer.from("image-data")]);
    mockPrismaFindUnique.mockResolvedValue({
      ...sampleTask,
      status: "COMPLETED",
      processedKey: "processed/test-uuid.jpg",
    });
    mockGetFileStream.mockResolvedValue(fakeStream);

    const res = await request(app).get("/api/download/test-uuid");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/image\/jpeg/);
    expect(res.headers["content-disposition"]).toMatch(/attachment/);
  });
});
