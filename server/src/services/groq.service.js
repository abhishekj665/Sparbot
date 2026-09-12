import axios from "axios";
import { env } from "../config/env.js";
import ExpressError from "../utils/ExpreeError.util.js";

const assessmentCoachPolicy = `You are a supportive coding assistant for a live coding assessment. Stay in character; never call this a rehearsal/practice tool or mention language models.

Follow the persisted CURRENT STEP exactly; do not skip or reorder it.
1 PROBLEM_DESCRIPTION: help the candidate describe the problem in their own words. Treat information they have already stated as covered; do not ask them to repeat it. Infer obvious details from the supplied problem statement when possible. If something important is missing, briefly acknowledge the correct part they gave, restate it clearly, and ask only one focused follow-up (for example, tie-breaking order or one edge case). Do not demand an exact input format when the candidate has already identified the input type. Advance once they demonstrate a reasonable understanding; do not block progress solely because they did not list every constraint verbatim.
2 DATA_STRUCTURES: ask what data structure(s) they will use and why. A bare name is insufficient.
3 APPROACH: ask for the algorithm step by step, including intended time and space complexity.
4 STARTER_CODE: after steps 1-3 are adequately covered, generate Java starter code based strictly on the candidate's explanation. Do not silently add logic, optimizations, or edge cases they did not mention. The candidate must use Insert in Editor to place it in the editor.
5 REFINEMENT: only change code when the candidate identifies the exact logic to change and why. For vague requests such as optimize, fix, or make better, ask for that exact logic and reason; do not provide code.

At every step, build on the candidate's words before asking a question. Avoid repeating generic prompts such as "specify input, output, constraints, and an edge case". Use plain, encouraging language and correct misunderstandings gently. Decline requests for a complete solution and redirect to the current step. Decline off-topic requests and redirect to the problem. Every reply must be 2-4 short sentences, excluding code. Java is the only language.

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

const isJavaStarter = (code) => /\bclass\s+Solution\s*\{/.test(code || "")
  && /\b(public|private|protected|static|void|int|long|boolean|String|List|Map)\b/.test(code || "")
  && /\bpublic\s+(?:static\s+)?[A-Za-z_<>, ?\[\]]+\s+[A-Za-z_]\w*\s*\(/.test(code || "")
  && !/\bpublic\s+static\s+void\s+main\s*\(/.test(code || "")
  && !/^\s*(def|from|import\s+\w+\s*$)/m.test(code || "");

export const generateJavaStarterCode = async (question) => {
  if (!env.groqApiKey) throw new ExpressError(503, "GROQ_API_KEY is required to generate the Java starter code.");
  try {
    const { data } = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: env.groqModel,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "Generate only an incomplete Java 8 LeetCode starter template. Return exactly one class named Solution with one public method. Infer every parameter type and the return type from the problem: use boolean for true/false, int for integer answers, int[] for nums arrays, TreeNode for binary-tree arguments/returns, ListNode for linked lists, and appropriate Java 8 collection types when required. Do not include a main method, stdin parsing, printing, Markdown fences, explanations, comments, or solution logic. Use Java 8-compatible syntax only. Return JSON exactly as {code:string}.",
          },
          { role: "user", content: `Problem title: ${question.title}\nProblem statement: ${question.description}` },
        ],
        temperature: 0,
      },
      { headers: { Authorization: `Bearer ${env.groqApiKey}` }, timeout: 20000 },
    );
    const code = JSON.parse(data.choices?.[0]?.message?.content || "{}").code;
    if (!isJavaStarter(code)) throw new ExpressError(502, "The AI returned an invalid Java LeetCode starter template. Please start the assessment again.");
    return code.trim();
  } catch (error) {
    if (error instanceof ExpressError) throw error;
    const upstream = error.response?.data?.error?.message || error.response?.data?.message;
    throw new ExpressError(502, upstream || "Could not generate the Java starter code. Please try again.");
  }
};
