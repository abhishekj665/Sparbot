import app from "./app.js";

import http from "http";

import { env } from "./config/env.js";

import { connectDb } from "./config/db.js";

const server = http.createServer(app);

const port = env.port;

const startServer = async () => {
  await connectDb();
  server.listen(port, (req, res) => {
    console.log(`Server is listening one port ${port}`);
  });
};

startServer();
