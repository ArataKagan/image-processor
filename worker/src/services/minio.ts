import { Client } from "minio";
import { config } from "../config";

const minioClient = new Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export async function downloadFile(key: string): Promise<Buffer> {
  const stream = await minioClient.getObject(config.minio.bucket, key);
  const chunks: Buffer[] = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await minioClient.putObject(config.minio.bucket, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
}
