import dotenv from "dotenv";
dotenv.config();

import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "dev-secret"; // fallback for local use

if (!process.env.JWT_SECRET) {
  console.warn("⚠️  JWT_SECRET missing in .env — using fallback 'dev-secret'");
} else {
  console.log("🔐 JWT_SECRET loaded from .env");
}

const generateToken = (payload) => {
  try {
    const token = jwt.sign(payload, SECRET, { expiresIn: "1h" });
    console.log("✅ JWT generated for:", payload.email);
    return token;
  } catch (err) {
    console.error("❌ Failed to generate JWT:", err);
    throw err;
  }
};

export { generateToken };
