import { Request, Response, NextFunction } from "express";
import { MulterError } from "multer";
import { errorHandler } from "../middleware/errorHandler";

function makeRes() {
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response;
  return res;
}

const req = {} as Request;
const next = jest.fn() as NextFunction;

describe("errorHandler", () => {
  it("returns 400 for MulterError", () => {
    const res = makeRes();
    errorHandler(new MulterError("LIMIT_FILE_SIZE"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for Invalid file type error", () => {
    const res = makeRes();
    errorHandler(new Error("Invalid file type. Accepted: JPG, PNG, WebP"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for Invalid task error", () => {
    const res = makeRes();
    errorHandler(new Error('Invalid task. Must be "resize" or "grayscale".'), req, res, next);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 400 for width/height validation error", () => {
    const res = makeRes();
    errorHandler(
      new Error("Width and height must be between 1 and 10000 for resize."),
      req,
      res,
      next
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 500 for unknown errors", () => {
    const res = makeRes();
    errorHandler(new Error("Something blew up"), req, res, next);
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: "Internal server error" });
  });
});
