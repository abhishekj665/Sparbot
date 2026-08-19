import app from "./app.js";

import http from "http";

import { env } from "./config/env.js";

import { connectDb } from "./config/db.js";

const server = http.createServer(app);

const port = env.port;

const startServer = () => {
  server.on("error", (error) =>
    console.error(`Server failed to start: ${error.message}`),
  );
  server.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
  connectDb()
    .then(() => console.log("Database ready"))
    .catch((error) => console.error(`Database unavailable: ${error.message}`));
};

startServer();
