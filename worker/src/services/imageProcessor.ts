import sharp from "sharp";

export async function resizeImage(
  buffer: Buffer,
  width: number,
  height: number
): Promise<Buffer> {
  return sharp(buffer)
    .resize(width, height, { fit: "inside" })
    .toBuffer();
}

export async function grayscaleImage(buffer: Buffer): Promise<Buffer> {
  return sharp(buffer).grayscale().toBuffer();
}
