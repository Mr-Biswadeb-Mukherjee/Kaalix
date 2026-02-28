import { verifyToken } from "../Utils/JWT.utils.js";
import { getUserOnboardingState } from "../Services/user.service.js";

/**
 * Middleware factory to control token revocation
 * @param {Object} options - { revoke: boolean, allowDuringOnboarding: boolean }
 */
export default function authMiddleware(options = {}) {
  const mergedOptions = {
    revoke: true,
    allowDuringOnboarding: false,
    ...options,
  };

  return async function (req, res, next) {
    try {
      const authHeader = req.headers.authorization || "";
      const token = authHeader.split(" ")[1];

      if (!token) {
        return res.status(401).json({ message: "🔐 Missing token" });
      }

      const payload = await verifyToken(token, { revoke: mergedOptions.revoke });
      const onboarding = await getUserOnboardingState(payload.user_id);

      if (!onboarding) {
        return res.status(401).json({ message: "Unauthorized: user not found." });
      }

      req.user = {
        ...payload,
        onboarding_required: onboarding.required,
      };
      req.onboarding = onboarding;
      req.token = token; // optional, useful for revocation

      if (onboarding.required && !mergedOptions.allowDuringOnboarding) {
        return res.status(423).json({
          success: false,
          code: "ONBOARDING_REQUIRED",
          message:
            "First-time setup is required. Update your profile and change password to continue.",
          onboarding,
          allowedEndpoints: {
            getProfile: "/api/v3/getprofile",
            updateProfile: "/api/v3/updateprofile",
            changePassword: "/api/v3/changepass",
          },
        });
      }

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
