import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import app from "./Routes/index.js";  
import { getDatabase } from "./Connectors/DB.js";
import { server } from "./Confs/config.js";
import { startAdminSoftDeletePurgeJob } from "./Services/adminLifecycle.service.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment
const PORT = server.port;
const NODE_ENV = server.nodeEnv;

// Serve uploads (static)
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Start server only after DB bootstrap succeeds
async function startServer() {
  try {
    await getDatabase();
    startAdminSoftDeletePurgeJob();
    app.listen(PORT, () => {
      console.log(
        `🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`
      );
    });
  } catch (err) {
    console.error(`❌ Startup aborted: ${err.message}`);
    process.exit(1);
  }
}

startServer();
