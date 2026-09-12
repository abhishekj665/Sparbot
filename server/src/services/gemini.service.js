import axios from "axios";
import { env } from "../config/env.js";

const fallback = ({ codeScore, aiScore, timeScore }) => {
  return {
    // Gemini gives qualitative feedback only. Execution-derived codeScore is retained.
    codeScore,
    aiScore,
    problemSolvingScore: codeScore,
    timeScore,
    finalScore: 0,
    result: "FAIL",
    summary: "Your score is based on the test cases passed and your assessment process.",
    timeComplexity: "Not available",
    efficiencyScore: codeScore,
  };
};

export const evaluateWithGemini = async (data) => {
  if (!env.geminiApiKey) return fallback(data);
  try {
    const prompt = `Review this submitted coding assessment. Return only JSON with problemSolvingScore, summary, and timeComplexity. problemSolvingScore is an integer 0-100. timeComplexity must be a concise Big-O estimate such as O(n), O(n log n), O(n²), or \"Unable to determine\". Do not award points for asking the assistant and do not override test execution. Give a concise, useful summary of code quality and likely edge cases.\nProblem: ${data.question.title}\n${data.question.description}\nLanguage: ${data.language}\nCode: ${data.code}`;
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
      codeScore: data.codeScore,
      aiScore: data.aiScore,
      problemSolvingScore: Math.min(
        100,
        Math.max(0, Number(result.problemSolvingScore) || data.codeScore),
      ),
      timeScore: data.timeScore,
      finalScore: 0,
      result: "FAIL",
      summary: String(result.summary || "Evaluation completed."),
      timeComplexity: String(result.timeComplexity || "Unable to determine"),
      efficiencyScore: data.codeScore,
    };
  } catch {
    return fallback(data);
  }
};
