import sharp from "sharp";

// --- Mocks ---

const mockPrismaUpdate = jest.fn();
jest.mock("../services/prisma", () => ({
  prisma: { task: { update: (...args: unknown[]) => mockPrismaUpdate(...args) } },
}));

const mockDownloadFile = jest.fn();
const mockUploadFile = jest.fn().mockResolvedValue(undefined);
jest.mock("../services/minio", () => ({
  downloadFile: (...args: unknown[]) => mockDownloadFile(...args),
  uploadFile: (...args: unknown[]) => mockUploadFile(...args),
}));

// --- Subject ---

import { processJob, JobPayload } from "../processor";
import { Job } from "bullmq";

function makeJob(data: JobPayload): Job<JobPayload> {
  return { id: "job-1", data } as unknown as Job<JobPayload>;
}

async function sampleJpeg(): Promise<Buffer> {
  return sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } },
  })
    .jpeg()
    .toBuffer();
}

describe("processJob", () => {
  beforeEach(() => jest.clearAllMocks());

  it("processes GRAYSCALE job and marks task COMPLETED", async () => {
    const img = await sampleJpeg();
    mockDownloadFile.mockResolvedValue(img);
    mockPrismaUpdate.mockResolvedValue({});

    await processJob(
      makeJob({ taskId: "t1", taskType: "GRAYSCALE", originalKey: "originals/t1.jpg", mimeType: "image/jpeg" })
    );

    expect(mockPrismaUpdate).toHaveBeenCalledWith(expect.objectContaining({ data: { status: "PROCESSING" } }));
    expect(mockUploadFile).toHaveBeenCalledWith("processed/t1.jpg", expect.any(Buffer), "image/jpeg");
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED", processedKey: "processed/t1.jpg" }) })
    );
  });

  it("processes RESIZE job and marks task COMPLETED", async () => {
    const img = await sampleJpeg();
    mockDownloadFile.mockResolvedValue(img);
    mockPrismaUpdate.mockResolvedValue({});

    await processJob(
      makeJob({
        taskId: "t2",
        taskType: "RESIZE",
        originalKey: "originals/t2.jpg",
        mimeType: "image/jpeg",
        params: { width: 50, height: 50 },
      })
    );

    expect(mockUploadFile).toHaveBeenCalledWith("processed/t2.jpg", expect.any(Buffer), "image/jpeg");
    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "COMPLETED" }) })
    );
  });

  it("marks task FAILED and rethrows when minio download fails", async () => {
    mockDownloadFile.mockRejectedValue(new Error("minio down"));
    mockPrismaUpdate.mockResolvedValue({});

    await expect(
      processJob(
        makeJob({ taskId: "t3", taskType: "GRAYSCALE", originalKey: "originals/t3.jpg", mimeType: "image/jpeg" })
      )
    ).rejects.toThrow("minio down");

    expect(mockPrismaUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "FAILED", errorMessage: "minio down" }) })
    );
  });
});
