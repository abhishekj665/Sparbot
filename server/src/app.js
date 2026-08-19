import express from "express";
import cors from "cors";
import { env } from "./config/env.js";
import authRouter from "./routes/auth.routes.js";
import assessmentRouter from "./routes/assessment.routes.js";
import { globalErrorHandler } from "./middlewares/GlobalErrorHandler.middleware.js";
import { requireDatabase } from "./middlewares/database.middleware.js";
import { successResponse } from "./utils/response.util.js";

const app = express();

app.use(cors({ origin: env.clientUrl.split(","), credentials: true }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.get("/api/health", (req, res) =>
  res.json(successResponse(null, "API is running")),
);
app.use("/api", requireDatabase);
app.use("/api/auth", authRouter);
app.use("/api/assessments", assessmentRouter);
app.use(globalErrorHandler);

export default app;
