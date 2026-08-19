import AIInteraction from "../models/AIInteraction.model.js";
import Evaluation from "../models/Evaluation.model.js";
import Exam from "../models/Exam.model.js";
import Question from "../models/Question.model.js";
import { evaluateWithGemini } from "./gemini.service.js";
import { askGroq } from "./groq.service.js";
import ExpressError from "../utils/ExpreeError.util.js";
import { successResponse } from "../utils/response.util.js";

const duration = 20 * 60 * 1000;
const difficulties = ["Easy", "Medium", "Hard"];
const languages = ["java", "python", "cpp"];
const visibleQuestion = (question) => ({
  id: question.id || question._id,
  title: question.title,
  difficulty: question.difficulty,
  topics: question.topics,
  description: question.description,
  starterCode: question.starterCode,
  entryPoint: question.entryPoint,
  allowedLanguages: question.assessment?.allowedLanguages || [],
});

const getExam = async (id, userId) => {
  const exam = await Exam.findOne({ _id: id, userId }).populate("questionId");
  if (!exam) throw new ExpressError(404, "Assessment not found");
  if (exam.status === "IN_PROGRESS" && exam.expiresAt <= new Date()) {
    exam.status = "EXPIRED";
    await exam.save();
  }
  return exam;
};

export const createAssessment = async (userId, { difficulty, language = "python" }) => {
  if (!difficulties.includes(difficulty))
    throw new ExpressError(400, "Choose Easy, Medium, or Hard");
  const active = await Exam.findOne({
    userId,
    status: "IN_PROGRESS",
    expiresAt: { $gt: new Date() },
  }).populate("questionId");
  if (active)
    return successResponse(
      { assessment: active, question: visibleQuestion(active.questionId) },
      "Active assessment found",
    );
  const [question] = await Question.aggregate([
    { $match: { difficulty } },
    { $sample: { size: 1 } },
  ]);
  if (!question)
    throw new ExpressError(
      404,
      `No ${difficulty} question is available`,
    );
  const startedAt = new Date();
  const assessment = await Exam.create({
    userId,
    questionId: question._id,
    startedAt,
    expiresAt: new Date(startedAt.getTime() + duration),
    language,
  });
  return successResponse(
    { assessment, question: visibleQuestion(question) },
    "Assessment started",
    201,
  );
};

export const findAssessment = async (userId, assessmentId) => {
  const assessment = await getExam(assessmentId, userId);
  return successResponse(
    { assessment, question: visibleQuestion(assessment.questionId) },
    "Assessment retrieved",
  );
};

export const createAiInteraction = async (
  userId,
  assessmentId,
  { message, code = "", interactionType = "OTHER", language },
) => {
  if (!message) throw new ExpressError(400, "Message is required");
  const assessment = await getExam(assessmentId, userId);
  if (assessment.status !== "IN_PROGRESS")
    throw new ExpressError(400, "Assessment is no longer active");
  const selectedLanguage = language || assessment.language;
  if (!languages.includes(selectedLanguage))
    throw new ExpressError(400, "Choose java, python, or cpp");
  const aiResponse = await askGroq({
    question: assessment.questionId,
    message,
    code,
    language: selectedLanguage,
  });
  const interaction = await AIInteraction.create({
    examId: assessment.id,
    userId,
    questionId: assessment.questionId.id,
    userMessage: message,
    aiResponse,
    interactionType,
  });
  return successResponse({ interaction }, "AI response generated");
};

export const completeAssessment = async (
  userId,
  assessmentId,
  { code, language },
) => {
  if (!code?.trim()) throw new ExpressError(400, "Code is required");
  if (language && !languages.includes(language))
    throw new ExpressError(400, "Choose java, python, or cpp");
  const assessment = await getExam(assessmentId, userId);
  if (assessment.status !== "IN_PROGRESS")
    throw new ExpressError(400, "Assessment is no longer active");
  const submittedAt = new Date();
  const interactions = await AIInteraction.find({ examId: assessment.id }).sort(
    { createdAt: 1 },
  );
  const timeUsedMinutes = Math.min(
    20,
    (submittedAt - assessment.startedAt) / 60000,
  );
  const codeScore = Math.min(70, Math.round(code.trim().length / 12));
  const aiScore = Math.min(
    100,
    interactions.length * 15 +
      new Set(interactions.map((item) => item.interactionType)).size * 8,
  );
  const timeScore = Math.max(0, Math.round(100 - timeUsedMinutes * 3));
  const evaluationData = await evaluateWithGemini({
    question: assessment.questionId,
    code,
    language: language || assessment.language,
    interactions,
    timeUsedMinutes: Math.round(timeUsedMinutes),
    codeScore,
    aiScore,
    timeScore,
  });
  Object.assign(assessment, {
    status: "SUBMITTED",
    submittedAt,
    finalCode: code,
    language: language || assessment.language,
    ...evaluationData,
  });
  await assessment.save();
  const evaluation = await Evaluation.findOneAndUpdate(
    { examId: assessment.id },
    {
      ...evaluationData,
      examId: assessment.id,
      aiAnalysis: {
        summary: evaluationData.summary,
        interactionCount: interactions.length,
      },
    },
    { new: true, upsert: true, runValidators: true },
  );
  return successResponse({ assessment, evaluation }, "Assessment submitted");
};

export const findEvaluation = async (userId, assessmentId) => {
  const assessment = await getExam(assessmentId, userId);
  const evaluation = await Evaluation.findOne({ examId: assessment.id });
  if (!evaluation) throw new ExpressError(404, "Evaluation is not available");
  return successResponse({ evaluation }, "Evaluation retrieved");
};
