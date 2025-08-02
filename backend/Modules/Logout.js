// Modules/Logout.js

/**
 * Core logout handler — decoupled from jwt.js, uses revokeToken injected via app.js
 */
async function logoutHandler(req, res) {
  console.log("📥 Received logout request");

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.warn("⚠️ Logout failed: Missing or invalid Authorization header");
      return res.status(401).json({
        success: false,
        message: "Missing or invalid Authorization header",
      });
    }

    const token = authHeader.split(" ")[1];
    console.log(`🔐 Attempting to revoke token: ${token.substring(0, 12)}...`);

    if (typeof res.revokeToken !== "function") {
      throw new Error("revokeToken function not found on response object");
    }

    await res.revokeToken(token);
    console.log("✅ Token successfully revoked");

    res.status(200).json({
      success: true,
      message: "Logout successful. Token revoked.",
    });
  } catch (error) {
    console.error("❌ Logout error:", error.message || error);
    res.status(500).json({
      success: false,
      message: "Logout failed due to server error.",
    });
  }
}

export default logoutHandler;
