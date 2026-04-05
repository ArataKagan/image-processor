import { Queue } from "bullmq";
import { config } from "../config";

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

export const imageQueue = new Queue<JobPayload>("image-processing", {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
  },
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 1000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});
