// Services/MFA.service.js
import { getDatabase } from "../Connectors/DB.js";
import { generateQRCodeDataUrl } from "./MFA/QRCode.MFA.js";
import speakeasy from "speakeasy";
import crypto from "node:crypto";

// Temporary in-memory store (use Redis in production)
const tempSecrets = new Map();

async function query(sql, params = []) {
  const db = await getDatabase();
  return db.query(sql, params);
}

export const MFAService = {
  /**
   * Get MFA status for methods the user has actually set up
   * @param {string} userId
   * @returns {Object} { methodName: status }
   */
  async getStatus(userId) {
    const [rows] = await query(
      "SELECT method, status FROM user_mfa WHERE user_id = ?",
      [userId]
    );

    const statusMap = {};
    rows.forEach((r) => {
      statusMap[r.method] = r.status; // 'enabled' only; disabled methods are deleted
    });

    return statusMap;
  },

  /**
   * Begin MFA setup -> generate secret + QR (not stored in DB yet)
   * @param {string} userId - user_id string from users table
   * @param {string} method
   * @returns {Object} { qrBlob, otpauthUrl, email }
   */
  async toggle(userId, method) {
    // Fetch user email from DB using user_id column
    const [userRows] = await query(
      "SELECT email FROM users WHERE user_id = ?",
      [userId]
    );

    if (userRows.length === 0) {
      throw new Error("User not found.");
    }

    const email = userRows[0].email;

    // Check if MFA is already enabled
    const [existing] = await query(
      "SELECT * FROM user_mfa WHERE user_id = ? AND method = ? AND status='enabled'",
      [userId, method]
    );

    if (existing.length > 0) {
      throw new Error("MFA already enabled. Disable first to reset.");
    }

    // Generate MFA ID and secret (not saved yet)
    const mfa_id = crypto.randomBytes(12).toString("hex"); // 24 chars
    const secret = speakeasy.generateSecret({
      length: 20,
      name: `${email}`, // account name shown on the right
      issuer: "KAALIX", // issuer shown on the left
    });

    // Store secret temporarily in memory (userId+method key)
    tempSecrets.set(`${userId}:${method}`, { mfa_id, secret });

    // Generate QR code
    const qrCodeDataUrl = await generateQRCodeDataUrl(secret.otpauth_url);

    // Convert Data URL to Buffer for frontend (Blob)
    const qrBlob = Buffer.from(qrCodeDataUrl.split(",")[1], "base64");

    return {
      qrBlob, // Blob for displaying QR code
      otpauthUrl: secret.otpauth_url, // full otpauth URL
      email, // user's email
    };
  },

  /**
   * Verify MFA OTP -> only now insert into DB as enabled
   * @param {string} userId
   * @param {string} method
   * @param {string} token
   */
  async verify(userId, method, token) {
    const temp = tempSecrets.get(`${userId}:${method}`);
    if (!temp) {
      throw new Error("No MFA setup in progress for this method.");
    }

    const { mfa_id, secret } = temp;

    // Verify OTP
    const verified = speakeasy.totp.verify({
      secret: secret.base32,
      encoding: "base32",
      token,
      window: 1,
    });

    if (!verified) throw new Error("Invalid OTP code.");

    // Insert into DB as enabled
    await query(
      `INSERT INTO user_mfa (user_id, mfa_id, method, status)
       VALUES (?, ?, ?, 'enabled')
       ON DUPLICATE KEY UPDATE status='enabled', updated_at=CURRENT_TIMESTAMP`,
      [userId, mfa_id, method]
    );

    // Store the secret securely in user_mfa_data
    await query(
      `INSERT INTO user_mfa_data (mfa_id, \`key\`, \`value\`)
       VALUES (?, 'secret', ?)
       ON DUPLICATE KEY UPDATE \`value\`=VALUES(\`value\`)`,
      [mfa_id, secret.base32]
    );

    // Cleanup temp secret
    tempSecrets.delete(`${userId}:${method}`);

    return { success: true };
  },

  /**
   * Disable MFA for a method -> completely remove MFA data for that user+method
   * @param {string} userId
   * @param {string} method
   */
  async disable(userId, method) {
    const [rows] = await query(
      "SELECT mfa_id, status FROM user_mfa WHERE user_id=? AND method=?",
      [userId, method]
    );

    if (rows.length === 0) {
      throw new Error("MFA method not found.");
    }

    const { mfa_id, status } = rows[0];

    if (status === "disabled") {
      throw new Error("MFA already disabled.");
    }

    // Delete all MFA-related data for this method
    await query("DELETE FROM user_mfa_data WHERE mfa_id=?", [mfa_id]);
    await query("DELETE FROM user_mfa WHERE user_id=? AND method=?", [
      userId,
      method,
    ]);

    return { success: true };
  },
};
