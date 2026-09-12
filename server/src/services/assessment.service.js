import AIInteraction from "../models/AIInteraction.model.js";
import Evaluation from "../models/Evaluation.model.js";
import Exam from "../models/Exam.model.js";
import Question from "../models/Question.model.js";
import { evaluateWithGemini } from "./gemini.service.js";
import { askGroq, generateJavaStarterCode } from "./groq.service.js";
import { getTestCases, runAgainstTests, runProgram, supportedLanguagesForQuestion } from "./runner.service.js";
import { createHash } from "node:crypto";
import ExpressError from "../utils/ExpreeError.util.js";
import { successResponse } from "../utils/response.util.js";

const duration = 20 * 60 * 1000;
const difficulties = ["Easy", "Medium", "Hard"];
const languages = ["java"];
const codeHash = (code) => createHash("sha256").update(String(code)).digest("hex");
const isJavaFunctionSubmission = (code, question, language) => language === "java"
  && !/public\s+static\s+void\s+main\s*\(/.test(code)
  && /\bclass\s+Solution\b/.test(code)
  && getTestCases(question).length > 0;
const assistantStages = ["PROBLEM_DESCRIPTION", "DATA_STRUCTURES", "APPROACH", "STARTER_CODE", "REFINEMENT"];
const processScoreFor = (stage) => Math.round((Math.max(0, assistantStages.indexOf(stage)) / (assistantStages.length - 1)) * 100);
const visibleTestResults = (results) => {
  const firstFailure = results.tests?.find((test) => !test.passed);
  return {
    available: results.available,
    passed: results.passed,
    total: results.total,
    message: results.message,
    tests: firstFailure ? [firstFailure] : [],
  };
};
const withoutJavaComments = (code) => String(code || "")
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/^\s*\/\/.*$/gm, "")
  .replace(/\n{3,}/g, "\n\n")
  .trim();
const starterFor = (question, generatedStarter) => {
  const starter = generatedStarter || question.starterCode?.java || (typeof question.starterCode === "string" ? question.starterCode : "");
  return withoutJavaComments(starter);
};
const visibleQuestion = (question, generatedStarter) => ({
  id: question.id || question._id,
  title: question.title,
  difficulty: question.difficulty,
  topics: question.topics,
  description: question.description,
  starterCode: { java: starterFor(question, generatedStarter) },
  entryPoint: question.entryPoint,
  allowedLanguages: supportedLanguagesForQuestion(question)
    .filter((language) => !question.assessment?.allowedLanguages?.length || question.assessment.allowedLanguages.includes(language)),
});

const getExam = async (id, userId, { allowExpired = false } = {}) => {
  const exam = await Exam.findOne({ _id: id, userId }).populate("questionId");
  if (!exam) throw new ExpressError(404, "Assessment not found");
  if (exam.status === "IN_PROGRESS" && exam.expiresAt <= new Date() && !allowExpired) {
    exam.status = "EXPIRED";
    await exam.save();
  }
  return exam;
};

export const createAssessment = async (userId, { difficulty, language = "java" }) => {
  if (!difficulties.includes(difficulty))
    throw new ExpressError(400, "Choose Easy, Medium, or Hard");
  if (!languages.includes(language))
    throw new ExpressError(400, "Java is the only supported language");
  const active = await Exam.findOne({
    userId,
    status: "IN_PROGRESS",
    expiresAt: { $gt: new Date() },
  }).populate("questionId");
  if (active)
    return successResponse(
      { assessment: active, question: visibleQuestion(active.questionId, active.starterCode) },
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
  if (question.assessment?.allowedLanguages?.length && !question.assessment.allowedLanguages.includes(language))
    throw new ExpressError(400, "This question does not support Java");
  const generatedStarter = await generateJavaStarterCode(question);
  if (!generatedStarter) throw new ExpressError(502, "Could not generate the Java starter code. Please try again.");
  const starterCode = starterFor(question, generatedStarter);
  const startedAt = new Date();
  const assessment = await Exam.create({
    userId,
    questionId: question._id,
    startedAt,
    expiresAt: new Date(startedAt.getTime() + duration),
    language,
    starterCode,
  });
  return successResponse(
    { assessment, question: visibleQuestion(question, starterCode) },
    "Assessment started",
    201,
  );
};

export const findAssessment = async (userId, assessmentId) => {
  const assessment = await getExam(assessmentId, userId);
  const interactions = await AIInteraction.find({ examId: assessment.id })
    .sort({ createdAt: 1 })
    .select("userMessage aiResponse suggestedCode interactionType createdAt");
  return successResponse(
    { assessment, question: visibleQuestion(assessment.questionId, assessment.starterCode), interactions },
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
    throw new ExpressError(400, "Java is the only supported language");
  const history = await AIInteraction.find({ examId: assessment.id })
    .sort({ createdAt: 1 })
    .select("userMessage aiResponse");
  const aiResult = await askGroq({
    question: assessment.questionId,
    message,
    code,
    language: selectedLanguage,
    history,
    stage: assessment.assistantStage || "PROBLEM_DESCRIPTION",
  });
  const stageTransitions = {
    PROBLEM_DESCRIPTION: "DATA_STRUCTURES",
    DATA_STRUCTURES: "APPROACH",
    APPROACH: "REFINEMENT",
    STARTER_CODE: "REFINEMENT",
    REFINEMENT: "REFINEMENT",
  };
  const currentStage = assistantStages.includes(assessment.assistantStage)
    ? assessment.assistantStage
    : "PROBLEM_DESCRIPTION";
  const nextStage = aiResult.advance && aiResult.nextStage === stageTransitions[currentStage]
    ? aiResult.nextStage
    : currentStage;
  const canSuggestCode = currentStage === "STARTER_CODE" || currentStage === "REFINEMENT"
    || (currentStage === "APPROACH" && nextStage === "REFINEMENT");
  assessment.assistantStage = nextStage;
  await assessment.save();
  const interaction = await AIInteraction.create({
    examId: assessment.id,
    userId,
    questionId: assessment.questionId.id,
    userMessage: message,
    aiResponse: aiResult.reply,
    suggestedCode: canSuggestCode ? aiResult.code : null,
    interactionType,
    assessmentStage: nextStage,
  });
  return successResponse({ interaction }, "AI response generated");
};

export const executeAssessment = async (userId, assessmentId, { code, language, input = "" }) => {
  const assessment = await getExam(assessmentId, userId);
  if (assessment.status !== "IN_PROGRESS") throw new ExpressError(400, "Assessment is no longer active");
  const selectedLanguage = language || assessment.language;
  const functionSubmission = isJavaFunctionSubmission(code, assessment.questionId, selectedLanguage);
  const functionTests = functionSubmission
    ? await runAgainstTests({ code, language: selectedLanguage, question: assessment.questionId })
    : null;
  const result = functionTests
    ? {
      code: !functionTests.available || functionTests.tests.some((test) => test.stderr) ? 1 : 0,
      output: functionTests.message || `${functionTests.passed}/${functionTests.total} function test cases passed.`,
      stdout: "",
      stderr: functionTests.tests.find((test) => test.stderr)?.stderr || (functionTests.available ? "" : functionTests.message),
      timedOut: functionTests.tests.some((test) => test.timedOut),
      time: null,
      memory: null,
    }
    : await runProgram({ code, language: selectedLanguage, input });
  if (result.code === 0) {
    assessment.lastSuccessfulRun = { codeHash: codeHash(code), language: selectedLanguage, completedAt: new Date() };
    await assessment.save();
  }
  return successResponse({ result }, "Code executed");
};

export const executeAssessmentTests = async (userId, assessmentId, { code, language }) => {
  const assessment = await getExam(assessmentId, userId);
  if (assessment.status !== "IN_PROGRESS") throw new ExpressError(400, "Assessment is no longer active");
  const selectedLanguage = language || assessment.language;
  if (!languages.includes(selectedLanguage)) throw new ExpressError(400, "Java is the only supported language");
  if (assessment.lastSuccessfulRun?.codeHash !== codeHash(code) || assessment.lastSuccessfulRun?.language !== selectedLanguage)
    throw new ExpressError(400, "Run the current code successfully before checking test cases.");
  const result = await runAgainstTests({ code, language: selectedLanguage, question: assessment.questionId });
  return successResponse({ result: visibleTestResults(result) }, "Database test cases executed");
};

export const completeAssessment = async (
  userId,
  assessmentId,
  { code, language, autoSubmit = false },
) => {
  const isAutoSubmit = autoSubmit === true;
  if (!code?.trim() && !isAutoSubmit) throw new ExpressError(400, "Code is required");
  if (language && !languages.includes(language))
    throw new ExpressError(400, "Java is the only supported language");
  // The browser timer can reach this request a few milliseconds after expiresAt.
  // Let that single automatic submission finish instead of discarding the draft.
  const assessment = await getExam(assessmentId, userId, { allowExpired: isAutoSubmit });
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
  const selectedLanguage = language || assessment.language;
  if (!isAutoSubmit && code?.trim() && (assessment.lastSuccessfulRun?.codeHash !== codeHash(code) || assessment.lastSuccessfulRun?.language !== selectedLanguage))
    throw new ExpressError(400, "Run the current code successfully before submitting. Hidden test cases run during submission.");
  const testResults = code?.trim()
    ? await runAgainstTests({ code, language: selectedLanguage, question: assessment.questionId })
    : { available: false, total: 0, passed: 0, tests: [], message: "No code was submitted, so no test cases were run." };
  // Correctness is derived from test execution, never from code size or AI output.
  const codeScore = testResults.available
    && testResults.total > 0 ? Math.round((testResults.passed / testResults.total) * 100)
    : 0;
  const aiScore = processScoreFor(assessment.assistantStage || "PROBLEM_DESCRIPTION");
  const timeScore = Math.max(0, Math.round(100 - timeUsedMinutes * 3));
  const evaluationData = await evaluateWithGemini({
    question: assessment.questionId,
    code,
    language: selectedLanguage,
    interactions,
    timeUsedMinutes: Math.round(timeUsedMinutes),
    codeScore,
    aiScore,
    timeScore,
  });
  // Test efficiency is the visible pass rate: 50% of cases passed is 50%, and all cases passed is 100%.
  const efficiencyScore = codeScore;
  evaluationData.efficiencyScore = efficiencyScore;
  evaluationData.finalScore = Math.round(codeScore * 0.6 + aiScore * 0.3 + efficiencyScore * 0.1);
  evaluationData.result = evaluationData.finalScore >= 60 && codeScore > 0 ? "PASS" : "FAIL";
  Object.assign(assessment, {
    status: "SUBMITTED",
    submittedAt,
    finalCode: code || "",
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
        processScore: aiScore,
        efficiencyScore,
        scoring: { correctnessWeight: 60, processWeight: 30, efficiencyWeight: 10 },
        timeComplexity: evaluationData.timeComplexity || "Not available",
        testResults: {
          ...visibleTestResults(testResults),
        },
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
