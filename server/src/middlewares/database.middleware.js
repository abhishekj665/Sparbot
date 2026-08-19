import mongoose from "mongoose";
import { errorResponse } from "../utils/response.util.js";

export const requireDatabase = (req, res, next) => {
  if (mongoose.connection.readyState === 1) return next();
  res.status(503).json(errorResponse(null, "Database is unavailable. Check MongoDB Atlas network access.", 503));
};
