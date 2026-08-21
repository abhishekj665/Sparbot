import { Router } from "express";
import { askAssistant, getAssessment, getEvaluation, runAssessment, runAssessmentTests, startAssessment, submitAssessment } from "../controllers/assessment.controller.js";
import { protect } from "../middlewares/auth.middleware.js";

const router = Router();
router.use(protect);
router.post("/start", startAssessment);
router.get("/:id", getAssessment);
router.post("/:id/assistant", askAssistant);
router.post("/:id/run", runAssessment);
router.post("/:id/test", runAssessmentTests);
router.post("/:id/submit", submitAssessment);
router.get("/:id/evaluation", getEvaluation);
export default router;
