import { verifyToken } from "../Utils/JWT.utils.js";

/**
 * Middleware factory to control token revocation
 * @param {Object} options - { revoke: boolean }
 */
export default function authMiddleware(options = { revoke: true }) {
  return async function (req, res, next) {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "🔐 Missing token" });
      }

      const payload = await verifyToken(token, { revoke: options.revoke });
      req.user = payload;
      req.token = token; // optional, useful for revocation
      next();
    } catch (err) {
      console.error("🛑 JWT verification failed:", err.message);
      res.status(401).json({
        message: err.message.includes("revoked")
          ? "Your account has been deleted or logged out from all devices."
          : "Invalid or expired token (replay blocked)"
      });
    }
  };
}
