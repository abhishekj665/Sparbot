import mongoose from "mongoose";
import { env } from "./env.js";

export const connectDb = async () => {
  if (!env.mongourl) throw new Error("MONGODB_URI is required");
  await mongoose.connect(env.mongourl, { serverSelectionTimeoutMS: 5000 });
  console.log("Database connected");
};

