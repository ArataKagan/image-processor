import { Worker } from "bullmq";
import { config } from "./config";
import { processJob, JobPayload } from "./processor";

const worker = new Worker<JobPayload>("image-processing", processJob, {
  connection: {
    host: config.redis.host,
    port: config.redis.port,
  },
  concurrency: 3,
});

worker.on("completed", (job) => {
  console.log(`Job ${job.id} completed for task ${job.data.taskId}`);
});

worker.on("failed", (job, err) => {
  console.error(`Job ${job?.id} failed:`, err.message);
});

console.log("Worker started, waiting for jobs...");

async function shutdown() {
  console.log("Shutting down worker...");
  await worker.close();
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
