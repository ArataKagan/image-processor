import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma";
import { getFileStream } from "../services/minio";

const router = Router();

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const task = await prisma.task.findUnique({ where: { id } });

    if (!task || task.status !== "COMPLETED" || !task.processedKey) {
      res.status(404).json({ error: "Task not found or not yet completed." });
      return;
    }

    const stream = await getFileStream(task.processedKey);

    res.setHeader("Content-Type", task.mimeType);
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="processed-${task.id}${extFromMime(task.mimeType)}"`
    );

    stream.pipe(res);
  } catch (err) {
    next(err);
  }
});

function extFromMime(mime: string): string {
  switch (mime) {
    case "image/jpeg":
      return ".jpg";
    case "image/png":
      return ".png";
    case "image/webp":
      return ".webp";
    default:
      return ".bin";
  }
}

export default router;
