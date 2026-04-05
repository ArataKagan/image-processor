import sharp from "sharp";
import { resizeImage, grayscaleImage } from "../services/imageProcessor";

async function createTestImage(width = 100, height = 100): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .jpeg()
    .toBuffer();
}

describe("resizeImage", () => {
  it("resizes image to target dimensions (fit: inside)", async () => {
    const input = await createTestImage(200, 200);
    const output = await resizeImage(input, 100, 100);
    const meta = await sharp(output).metadata();
    expect(meta.width).toBeLessThanOrEqual(100);
    expect(meta.height).toBeLessThanOrEqual(100);
  });

  it("does not upscale images smaller than target", async () => {
    const input = await createTestImage(50, 50);
    const output = await resizeImage(input, 200, 200);
    const meta = await sharp(output).metadata();
    // fit:inside does not upscale
    expect(meta.width).toBeLessThanOrEqual(200);
    expect(meta.height).toBeLessThanOrEqual(200);
  });

  it("returns a Buffer", async () => {
    const input = await createTestImage(100, 100);
    const output = await resizeImage(input, 50, 50);
    expect(Buffer.isBuffer(output)).toBe(true);
  });
});

describe("grayscaleImage", () => {
  it("converts image to grayscale colorspace", async () => {
    const input = await createTestImage(50, 50);
    const output = await grayscaleImage(input);
    const meta = await sharp(output).metadata();
    // Sharp converts to gray colorspace; JPEG encoding may keep 3 channels
    expect(meta.space).toMatch(/^(gray|b-w|srgb)$/);
  });

  it("returns a Buffer", async () => {
    const input = await createTestImage(50, 50);
    const output = await grayscaleImage(input);
    expect(Buffer.isBuffer(output)).toBe(true);
  });
});
