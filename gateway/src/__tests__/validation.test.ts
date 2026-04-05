import { validateUpload } from "../validation/upload";

describe("validateUpload", () => {
  it("returns GRAYSCALE task", () => {
    const result = validateUpload({ task: "grayscale" });
    expect(result).toEqual({ task: "GRAYSCALE" });
  });

  it("is case-insensitive for task", () => {
    const result = validateUpload({ task: "GRAYSCALE" });
    expect(result.task).toBe("GRAYSCALE");
  });

  it("returns RESIZE task with width and height", () => {
    const result = validateUpload({ task: "resize", width: "800", height: "600" });
    expect(result).toEqual({ task: "RESIZE", width: 800, height: 600 });
  });

  it("throws on invalid task type", () => {
    expect(() => validateUpload({ task: "blur" })).toThrow("Invalid task");
  });

  it("throws on RESIZE without dimensions", () => {
    expect(() => validateUpload({ task: "resize" })).toThrow("Width and height");
  });

  it("throws on RESIZE with zero width", () => {
    expect(() => validateUpload({ task: "resize", width: "0", height: "600" })).toThrow(
      "Width and height"
    );
  });

  it("throws on RESIZE with dimension exceeding 10000", () => {
    expect(() =>
      validateUpload({ task: "resize", width: "10001", height: "600" })
    ).toThrow("Width and height");
  });
});
