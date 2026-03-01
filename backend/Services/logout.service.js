// Modules/Logout.js
import { resetPublicIPAndLocation } from "./status.service.js"; // 👈 import the reset function

/**
 * 🔒 Secure logout handler — revokes JWT and clears cached system IP/location
 */
async function logoutHandler(req, res) {
  console.log("📥 Logout request received");

  try {
    const authHeader = req.headers.authorization || "";
    const token = authHeader.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    if (!token) {
      console.warn("⚠️ Missing or malformed token in Authorization header");
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No valid token provided",
      });
    }

    if (typeof res.revokeToken !== "function") {
      console.error("❌ revokeToken not injected into response object");
      return res.status(500).json({
        success: false,
        message: "Server misconfiguration: revokeToken unavailable",
      });
    }

    await res.revokeToken(token);
    console.log("✅ Token revoked successfully");

    // 👇 Clear cached IP + location on logout
    resetPublicIPAndLocation();

    return res.status(200).json({
      success: true,
      message: "Logout successful. Token revoked and cache cleared.",
    });
  } catch (err) {
    console.error("❌ Logout error:", err.stack || err.message || err);
    return res.status(500).json({
      success: false,
      message: "Server error during logout",
    });
  }
}

export default logoutHandler;
