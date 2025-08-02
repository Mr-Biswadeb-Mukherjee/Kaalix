// Middleware/AuthMiddleware.js
import { verifyToken } from "../Utils/JWT.js";

export default async function authMiddleware(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ message: "🔐 Missing token" });
    }

    const payload = await verifyToken(token); // Enforce single-use here
    req.user = payload;
    next();
  } catch (err) {
    console.error("🛑 JWT verification failed:", err.message);
    res.status(401).json({ message: "Invalid or expired token (replay blocked)" });
  }
}
