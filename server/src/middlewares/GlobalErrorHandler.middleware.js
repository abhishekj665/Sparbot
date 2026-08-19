import { errorResponse } from "../utils/response.util.js";

export const globalErrorHandler = (err, req, res, next) => {
  const status = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
  res.status(status).json(errorResponse(null, err.message || "Internal server error", status));
};
