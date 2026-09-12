import dotenv from "dotenv";

// Resolve the API environment file from this module, not Node's current folder.
// This keeps `npm run dev` working whether it is started in `server/` or the workspace root.
dotenv.config({ path: new URL("../../.env", import.meta.url) });

export const env = {
  port: process.env.PORT || 5000,
  mongourl: process.env.MONGODB_URI,
  tokenSecret: process.env.TOKEN_SECRET || "sparbot-development-secret",
  groqApiKey: process.env.GROQ_API_KEY,
  groqModel: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
  geminiApiKey: process.env.GEMINI_API_KEY,
  runnerProvider: "piston",
  runnerUrl: process.env.RUNNER_API_URL || "http://localhost:2000/api/v2/execute",
  runnerApiKey: process.env.RUNNER_API_KEY || "",
  clientUrl: process.env.CLIENT_URL,
};
