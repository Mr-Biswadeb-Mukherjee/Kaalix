import { fileURLToPath } from "url";
import path from "node:path";
import http from "node:http";
import express from "express";
import app from "./Routes/index.js";  
import { getDatabase } from "./Connectors/DB.js";
import { server } from "./Confs/config.js";
import { startAdminSoftDeletePurgeJob } from "./Services/adminLifecycle.service.js";
import { initializeRealtimeGateway } from "./Realtime/realtime.gateway.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment
const PORT = server.port;
const NODE_ENV = server.nodeEnv;
const DB_BOOTSTRAP_BASE_DELAY_MS = 2000;
const DB_BOOTSTRAP_MAX_DELAY_MS = 30000;

// Serve uploads (static)
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForDatabaseReady() {
  let attempt = 0;

  while (true) {
    try {
      await getDatabase();
      return;
    } catch (err) {
      attempt += 1;
      const delayMs = Math.min(
        DB_BOOTSTRAP_BASE_DELAY_MS * 2 ** Math.max(0, attempt - 1),
        DB_BOOTSTRAP_MAX_DELAY_MS
      );

      console.error(`❌ Database bootstrap failed (attempt ${attempt}): ${err.message}`);
      console.error(`⏳ Retrying database bootstrap in ${Math.round(delayMs / 1000)}s...`);
      await sleep(delayMs);
    }
  }
}

// Start server only after DB bootstrap succeeds
async function startServer() {
  await waitForDatabaseReady();
  startAdminSoftDeletePurgeJob();
  const httpServer = http.createServer(app);
  initializeRealtimeGateway(httpServer);
  httpServer.listen(PORT, () => {
    console.log(
      `🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT} (realtime enabled)`
    );
  });
}

startServer().catch((err) => {
  console.error(`❌ Startup aborted: ${err.message}`);
});
