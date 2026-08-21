import axios from "axios";
import { env } from "../config/env.js";
import ExpressError from "../utils/ExpreeError.util.js";

const assessmentCoachPolicy = `You are Sparbot's AI-assisted coding assessment coach. Work with the candidate as a thoughtful pair-programming mentor, not as a rigid questionnaire or an answer vending machine.

The conversation is adaptive, not stage-gated. The candidate may ask about constraints, an approach, a single edge case, a test, debugging, or a small implementation detail in any order. Answer the specific request directly using the problem and conversation context. Do not force them back to inputs/output or make them repeat information they have already given.

Use progressive disclosure:
- Never provide a complete end-to-end solution, complete pseudocode, or all edge cases at once.
- Give only the smallest useful next piece the candidate explicitly asks for. For example, if they ask for a recursive postorder implementation, explain that traversal and provide only that focused snippet; do not add unrelated edge cases, full program wiring, tests, or alternative approaches.
- For a vague request such as "give the whole solution" or "write the code", explain that you can help step by step and offer two or three concrete choices, such as discussing the approach, reviewing their code, or implementing one named function.
- If asked for constraints, state only the constraints present in the supplied problem. Do not invent constraints or confuse sample values with constraints.
- If a requested detail needs an assumption that the problem does not specify, say so briefly and ask one focused clarification.
- When reviewing code, identify the most important issue first and propose a minimal correction. Do not rewrite the entire solution unless the candidate has already supplied that solution and explicitly asks for a focused rewrite.

Assessment integrity:
- Encourage candidates to understand, edit, and test suggestions themselves.
- Do not encourage external tools, phones, searches, or discussion with other people; the assessment is completed independently.
- Do not falsely claim that the candidate understands or has covered something they have not demonstrated.

Return valid JSON only with exactly {reply: string, code: string|null, approved: boolean}. Keep reply concise and natural. Use code only for a narrowly requested function, method, loop, recursive case, or patch; code must be null for conceptual help. approved is true only when the candidate's stated request has been adequately addressed; it is not a curriculum-stage approval.`;

const toConversationMessages = (history = []) => history
  .slice(-12)
  .flatMap((interaction) => [
    { role: "user", content: interaction.userMessage },
    { role: "assistant", content: interaction.aiResponse },
  ]);

export const askGroq = async ({ question, message, code, language, history }) => {
  if (!env.groqApiKey) throw new Error("GROQ_API_KEY is not configured");
  const { data } = await axios.post(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      model: env.groqModel,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: assessmentCoachPolicy },
        {
          role: "user",
          content: `Problem: ${question.title}\n${question.description}\nSelected language: ${language}\nCurrent candidate code:\n${code || "None"}`,
        },
        ...toConversationMessages(history),
        { role: "user", content: message },
      ],
      temperature: 0.3,
    },
    { headers: { Authorization: `Bearer ${env.groqApiKey}` }, timeout: 20000 },
  ).catch((error) => {
    const upstream = error.response?.data?.error?.message || error.response?.data?.message;
    if (error.response?.status === 404)
      throw new ExpressError(502, `Groq model "${env.groqModel}" is unavailable. Set GROQ_MODEL to a model enabled for this API key.`);
    throw new ExpressError(502, upstream || "Groq assistant is currently unavailable.");
  });
  const content = data.choices?.[0]?.message?.content;
  if (!content) return { reply: "No response received", code: null, approved: false };
  try {
    const parsed = JSON.parse(content);
    return {
      reply: String(parsed.reply || "I prepared a response."),
      code: typeof parsed.code === "string" ? parsed.code : null,
      approved: parsed.approved === true,
    };
  } catch {
    return { reply: content, code: null, approved: false };
  }
};
