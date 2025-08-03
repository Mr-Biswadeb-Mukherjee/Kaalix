// Modules/Logout.js

/**
 * 🔒 Secure logout handler — revokes JWT via injected utility
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
    console.log(`✅ Token revoked successfully: ${token.substring(0, 10)}...`);

    return res.status(200).json({
      success: true,
      message: "Logout successful. Token revoked.",
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
