import { Router, Request, Response, NextFunction } from "express";
import { prisma } from "../services/prisma";

const router = Router();

router.get("/:id", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = req.params.id as string;
    const task = await prisma.task.findUnique({ where: { id } });

    if (!task) {
      res.status(404).json({ error: "Task not found." });
      return;
    }

    res.json({
      id: task.id,
      status: task.status,
      taskType: task.taskType,
      params: task.params,
      originalKey: task.originalKey,
      processedKey: task.processedKey,
      errorMessage: task.errorMessage,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
