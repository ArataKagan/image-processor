import { Job } from "bullmq";
import path from "path";
import { prisma } from "./services/prisma";
import { downloadFile, uploadFile } from "./services/minio";
import { resizeImage, grayscaleImage } from "./services/imageProcessor";

export interface JobPayload {
  taskId: string;
  taskType: "RESIZE" | "GRAYSCALE";
  originalKey: string;
  mimeType: string;
  params?: {
    width: number;
    height: number;
  };
}

export async function processJob(job: Job<JobPayload>): Promise<void> {
  const { taskId, taskType, originalKey, mimeType, params } = job.data;

  await prisma.task.update({
    where: { id: taskId },
    data: { status: "PROCESSING" },
  });

  try {
    const originalBuffer = await downloadFile(originalKey);

    let processedBuffer: Buffer;
    if (taskType === "RESIZE" && params) {
      processedBuffer = await resizeImage(originalBuffer, params.width, params.height);
    } else {
      processedBuffer = await grayscaleImage(originalBuffer);
    }

    const ext = path.extname(originalKey);
    const processedKey = `processed/${taskId}${ext}`;

    await uploadFile(processedKey, processedBuffer, mimeType);

    await prisma.task.update({
      where: { id: taskId },
      data: { status: "COMPLETED", processedKey },
    });

    console.log(`Task ${taskId} completed successfully`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    await prisma.task.update({
      where: { id: taskId },
      data: { status: "FAILED", errorMessage: message },
    });
    console.error(`Task ${taskId} failed:`, message);
    throw err;
  }
}
