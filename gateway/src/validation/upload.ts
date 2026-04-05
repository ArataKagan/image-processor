export interface UploadValidation {
  task: "RESIZE" | "GRAYSCALE";
  width?: number;
  height?: number;
}

export function validateUpload(body: Record<string, string>): UploadValidation {
  const task = body.task?.toUpperCase();
  if (task !== "RESIZE" && task !== "GRAYSCALE") {
    throw new Error('Invalid task. Must be "resize" or "grayscale".');
  }

  if (task === "RESIZE") {
    const width = parseInt(body.width, 10);
    const height = parseInt(body.height, 10);
    if (!width || !height || width < 1 || height < 1 || width > 10000 || height > 10000) {
      throw new Error("Width and height must be between 1 and 10000 for resize.");
    }
    return { task, width, height };
  }

  return { task };
}
