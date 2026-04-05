import { Router, Request, Response, NextFunction } from "express";
import { v4 as uuidv4 } from "uuid";
import path from "path";
import { upload } from "../middleware/multer";
import { validateUpload } from "../validation/upload";
import { prisma } from "../services/prisma";
import { uploadFile } from "../services/minio";
import { imageQueue, JobPayload } from "../services/queue";

const router = Router();

router.post(
  "/",
  upload.single("image"),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No image file provided." });
        return;
      }

      const validation = validateUpload(req.body);
      const ext = path.extname(req.file.originalname) || ".jpg";
      const id = uuidv4();
      const originalKey = `originals/${id}${ext}`;

      await uploadFile(originalKey, req.file.buffer, req.file.mimetype);

      const task = await prisma.task.create({
        data: {
          id,
          taskType: validation.task,
          params: validation.width
            ? { width: validation.width, height: validation.height }
            : undefined,
          originalKey,
          mimeType: req.file.mimetype,
        },
      });

      const jobPayload: JobPayload = {
        taskId: task.id,
        taskType: validation.task,
        originalKey,
        mimeType: req.file.mimetype,
        params:
          validation.width && validation.height
            ? { width: validation.width, height: validation.height }
            : undefined,
      };

      await imageQueue.add("process-image", jobPayload);

      res.status(201).json({ taskId: task.id, status: task.status });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
