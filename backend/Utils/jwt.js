import jwt from "jsonwebtoken";
import crypto from "crypto";

// Memory-based secret rotation
let currentSecret = generateSecret();
let previousSecret = null;

// Rotate every 10 minutes
const ROTATION_INTERVAL = 10 * 60 * 1000;

setInterval(() => {
  previousSecret = currentSecret;
  currentSecret = generateSecret();
  console.log("🔁 JWT secret rotated at:", new Date().toISOString());
}, ROTATION_INTERVAL);

function generateSecret() {
  return crypto.randomBytes(64).toString("hex"); // 512-bit secret
}

/**
 * Generate a signed JWT with current secret
 */
const generateToken = (payload) => {
  try {
    const token = jwt.sign(payload, currentSecret, { expiresIn: "10m" });
    console.log("✅ JWT generated for:", payload.email || "unknown");
    return token;
  } catch (err) {
    console.error("❌ Failed to generate JWT:", err);
    throw err;
  }
};

/**
 * Verify JWT with current and fallback (previous) secrets
 */
const verifyToken = (token) => {
  try {
    // Try with current secret
    return jwt.verify(token, currentSecret);
  } catch (err) {
    try {
      // Try with previous secret as fallback
      return jwt.verify(token, previousSecret);
    } catch (e) {
      console.error("❌ JWT verification failed:", e.message);
      throw e;
    }
  }
};

export { generateToken, verifyToken };
