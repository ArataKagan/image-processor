import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  console.error("Error:", err.message);

  if (err instanceof MulterError) {
    res.status(400).json({ error: err.message });
    return;
  }

  const clientErrors = ["Invalid file type", "Invalid task", "Width and height"];
  if (clientErrors.some((msg) => err.message.includes(msg))) {
    res.status(400).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: "Internal server error" });
}
