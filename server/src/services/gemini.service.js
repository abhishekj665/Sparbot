import axios from "axios";
import { env } from "../config/env.js";

const fallback = ({ codeScore, aiScore, timeScore }) => {
  const finalScore = Math.round(
    codeScore * 0.5 + aiScore * 0.3 + timeScore * 0.2,
  );
  return {
    codeScore,
    aiScore,
    problemSolvingScore: codeScore,
    timeScore,
    finalScore,
    result: finalScore >= 75 ? "PASS" : "FAIL",
    summary: "Evaluation completed without Gemini.",
  };
};

export const evaluateWithGemini = async (data) => {
  if (!env.geminiApiKey) return fallback(data);
  try {
    const prompt = `Evaluate this coding assessment. Return only JSON with codeScore, aiScore, problemSolvingScore, timeScore, finalScore, result, summary. Every score is an integer from 0 to 100 and result is PASS or FAIL.\nProblem: ${data.question.title}\n${data.question.description}\nLanguage: ${data.language}\nCode: ${data.code}\nTime used: ${data.timeUsedMinutes} minutes\nAI interactions: ${JSON.stringify(data.interactions.map((item) => ({ question: item.userMessage, type: item.interactionType })))}`;
    const { data: response } = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${env.geminiApiKey}`,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.2,
        },
      },
      { timeout: 30000 },
    );
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return fallback(data);
    const result = JSON.parse(text);
    return {
      codeScore: Math.min(
        100,
        Math.max(0, Number(result.codeScore) || data.codeScore),
      ),
      aiScore: Math.min(
        100,
        Math.max(0, Number(result.aiScore) || data.aiScore),
      ),
      problemSolvingScore: Math.min(
        100,
        Math.max(0, Number(result.problemSolvingScore) || data.codeScore),
      ),
      timeScore: Math.min(
        100,
        Math.max(0, Number(result.timeScore) || data.timeScore),
      ),
      finalScore: Math.min(100, Math.max(0, Number(result.finalScore) || 0)),
      result: result.result === "PASS" ? "PASS" : "FAIL",
      summary: String(result.summary || "Evaluation completed."),
    };
  } catch {
    return fallback(data);
  }
};
