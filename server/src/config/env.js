import dotenv from "dotenv";

dotenv.config();

export const env = {
  port: process.env.PORT,
  mongourl: process.env.MONGODB_URI,
};
