import path from "path";
import { fileURLToPath } from "url";

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

import { generateToken, verifyToken, revokeToken } from "./Utils/JWT.js";
import routeRegister from "./Utils/routeRegister.js";

// Reconstruct __dirname in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment
const PORT = 4000;
const NODE_ENV = "development";

const app = express();

app.use(cors());
app.use(bodyParser.json());

// Inject JWT utils into res object
app.use((req, res, next) => {
  res.generateToken = generateToken;
  res.verifyToken = verifyToken;
  res.revokeToken = revokeToken;
  next();
});

// Register routes dynamically
routeRegister(app);

// 🔥 Global Error Handler
app.use((err, req, res, next) => {
  console.error("🔥 Global error caught:", err.stack || err);
  res.status(500).json({
    success: false,
    message: "Internal Server Error. Something went wrong on our end.",
  });
});

// 🚀 Start the server
app.listen(PORT, () => {
  console.log(`🟢 Server running in ${NODE_ENV} mode at http://localhost:${PORT}`);
});
