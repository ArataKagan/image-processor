import { Client } from "minio";
import { config } from "../config";
import { Readable } from "stream";

const minioClient = new Client({
  endPoint: config.minio.endPoint,
  port: config.minio.port,
  useSSL: config.minio.useSSL,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string
): Promise<void> {
  await minioClient.putObject(config.minio.bucket, key, buffer, buffer.length, {
    "Content-Type": contentType,
  });
}

export async function getFileStream(key: string): Promise<Readable> {
  return minioClient.getObject(config.minio.bucket, key);
}
