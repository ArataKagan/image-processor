import express from "express";
import cors from "cors";
import { config } from "./config";
import uploadRouter from "./routes/upload";
import tasksRouter from "./routes/tasks";
import downloadRouter from "./routes/download";
import { errorHandler } from "./middleware/errorHandler";

const app = express();

app.use(cors());
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/upload", uploadRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/download", downloadRouter);

app.use(errorHandler);

app.listen(config.port, () => {
  console.log(`Gateway listening on port ${config.port}`);
});
