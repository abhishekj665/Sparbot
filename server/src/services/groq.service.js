import axios from "axios";
import { env } from "../config/env.js";
import ExpressError from "../utils/ExpreeError.util.js";

const assessmentCoachPolicy = `You are the coding assistant for a live vibe-coding assessment. Stay in character; never call this a rehearsal/practice tool or mention language models.

Follow the persisted CURRENT STEP exactly; do not skip or reorder it.
1 PROBLEM_DESCRIPTION: ask the candidate to describe the problem in their own words, including inputs, outputs, constraints, and one edge case. Do not advance unless all are reasonably covered.
2 DATA_STRUCTURES: ask what data structure(s) they will use and why. A bare name is insufficient.
3 APPROACH: ask for the algorithm step by step, including intended time and space complexity.
4 STARTER_CODE: after steps 1-3 are adequately covered, generate Java starter code based strictly on the candidate's explanation. Do not silently add logic, optimizations, or edge cases they did not mention. The candidate must use Insert in Editor to place it in the editor.
5 REFINEMENT: only change code when the candidate identifies the exact logic to change and why. For vague requests such as optimize, fix, or make better, ask for that exact logic and reason; do not provide code.

At every step, decline requests for a complete solution and redirect to the current step. Decline off-topic requests and redirect to the problem. Every reply must be 2-4 short sentences, excluding code. Java is the only language.

Return valid JSON only with exactly {reply: string, code: string|null, advance: boolean, nextStage: string}. nextStage must be one of PROBLEM_DESCRIPTION, DATA_STRUCTURES, APPROACH, STARTER_CODE, REFINEMENT. Set advance true only when the current step is adequately covered. At APPROACH, when it is adequately covered, include Step 4 Java starter code and set nextStage to REFINEMENT. At all other conceptual steps code is null. At STARTER_CODE generate code and move to REFINEMENT. In REFINEMENT return Java code only for a specific, justified change.`;

const toConversationMessages = (history = []) => history
  .slice(-12)
  .flatMap((interaction) => [
    { role: "user", content: interaction.userMessage },
    { role: "assistant", content: interaction.aiResponse },
  ]);

export const askGroq = async ({ question, message, code, language, history, stage }) => {
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
          content: `Problem: ${question.title}\n${question.description}\nLanguage: Java\nCURRENT STEP: ${stage}\nCurrent candidate code:\n${code || "None"}`,
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
  if (!content) return { reply: "No response received", code: null, advance: false, nextStage: stage };
  try {
    const parsed = JSON.parse(content);
    return {
      reply: String(parsed.reply || "I prepared a response."),
      code: typeof parsed.code === "string" ? parsed.code : null,
      advance: parsed.advance === true,
      nextStage: typeof parsed.nextStage === "string" ? parsed.nextStage : stage,
    };
  } catch {
    return { reply: content, code: null, advance: false, nextStage: stage };
  }
};
