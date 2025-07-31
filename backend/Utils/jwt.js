import jwt from "jsonwebtoken";
import crypto from "crypto";

// Store secrets by key ID (timestamp-based)
const secrets = new Map();
let currentKid = Date.now().toString();
secrets.set(currentKid, generateSecret());

// Rotate every 10 minutes
const ROTATION_INTERVAL = 10 * 60 * 1000;

setInterval(() => {
  const newKid = Date.now().toString();
  const newSecret = generateSecret();

  secrets.set(newKid, newSecret);
  currentKid = newKid;

  // Retain only last 2 versions
  if (secrets.size > 2) {
    const oldest = [...secrets.keys()].sort()[0];
    secrets.delete(oldest);
  }

  console.log("🔁 JWT secret rotated. New kid:", currentKid, "at", new Date().toISOString());
}, ROTATION_INTERVAL);

// Secret generator
function generateSecret() {
  return crypto.randomBytes(64).toString("hex"); // 512-bit
}

/**
 * Generate a signed JWT with current secret and kid
 */
const generateToken = (payload) => {
  try {
    const token = jwt.sign(payload, secrets.get(currentKid), {
      expiresIn: "10m",
      algorithm: "HS512",
      header: {
        kid: currentKid,
      },
    });

    console.log("✅ JWT generated:");
    console.log(`📦 Payload: ${JSON.stringify(payload, null, 2)}`);
    console.log(`🔑 Key ID (kid): ${currentKid}`);
    console.log(`🪙 Token:\n${token}\n`);

    return token;
  } catch (err) {
    console.error("❌ Failed to generate JWT:", err);
    throw err;
  }
};


/**
 * Verify JWT using the kid from the token header
 */
const verifyToken = (token) => {
  try {
    const decodedHeader = jwt.decode(token, { complete: true });

    if (!decodedHeader || !decodedHeader.header.kid) {
      throw new Error("Missing kid in token header");
    }

    const { kid } = decodedHeader.header;
    const secret = secrets.get(kid);

    if (!secret) {
      throw new Error(`No secret found for kid=${kid}`);
    }

    return jwt.verify(token, secret, { algorithms: ["HS512"] });
  } catch (err) {
    console.error("❌ JWT verification failed:", err.message);
    throw err;
  }
};

export { generateToken, verifyToken };
