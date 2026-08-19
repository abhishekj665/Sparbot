import { MongoClient } from "mongodb";
import { env } from "./env.js";

const mongourl = env.mongourl;

const client = new MongoClient(mongourl);

export const connectDb = async () => {
  try {
    await client.connect();
    console.log("Database Connected Successfully");
  } catch (error) {
    console.log(error?.message || "Database Connection Error");
  }
}

