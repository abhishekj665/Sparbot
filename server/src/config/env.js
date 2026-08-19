import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT || 5000,
  mongourl: process.env.MONGODB_URI,
  tokenSecret: process.env.TOKEN_SECRET || "sparbot-development-secret",
  groqApiKey: process.env.GROQ_API_KEY || "",
  geminiApiKey: process.env.GEMINI_API_KEY || "",
  clientUrl: process.env.CLIENT_URL,
};
