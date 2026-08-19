import axios from "axios";
import { env } from "../config/env.js";

export const askGroq = async ({ question, message, code, language }) => {
  if (!env.groqApiKey) throw new Error("GROQ_API_KEY is not configured");
  const { data } = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are Sparbot's assessment mentor. Help with reasoning, debugging, and validation. Do not provide a complete solution or final code. Keep responses concise.",
        },
        {
          role: "user",
          content: `Problem: ${question.title}\n${question.description}\nSelected language: ${language}\nCandidate code:\n${code || "None"}\nQuestion: ${message}`,
        },
      ],
      temperature: 0.3,
    },
    { headers: { Authorization: `Bearer ${env.groqApiKey}` }, timeout: 20000 },
  );
  return data.choices?.[0]?.message?.content || "No response received";
};
