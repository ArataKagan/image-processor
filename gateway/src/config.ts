export const config = {
  port: parseInt(process.env.PORT || "4000", 10),
  database: {
    url: process.env.DATABASE_URL || "postgresql://imgproc:imgproc@localhost:5432/imgproc",
  },
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
  },
  minio: {
    endPoint: process.env.MINIO_ENDPOINT || "localhost",
    port: parseInt(process.env.MINIO_PORT || "9000", 10),
    accessKey: process.env.MINIO_ACCESS_KEY || "minioadmin",
    secretKey: process.env.MINIO_SECRET_KEY || "minioadmin",
    bucket: process.env.MINIO_BUCKET || "images",
    useSSL: false,
  },
};
