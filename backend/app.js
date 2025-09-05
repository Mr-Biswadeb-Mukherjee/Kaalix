import { fileURLToPath } from "url";
import path from "path";
import express from "express";
import app from "./Routes/index.js";  

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment
const PORT = 4000;
const NODE_ENV = "development";

// Serve uploads (static)
app.use("/uploads", express.static(path.join(__dirname, "public/uploads")));

// Start server
app.listen(PORT, () => {
  console.log(`🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`);
});
