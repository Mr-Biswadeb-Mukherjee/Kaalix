import express from "express";
import {
  loginUser,
  comparePassword,
  updateFailedAttempts,
  USER_ACCOUNT_STATUSES,
} from "./user.service.js";

import { verifyCaptchaChallenge } from "./captcha.service.js";
import {
  BUSINESS_EMAIL_REQUIRED_MESSAGE,
  isPersonalEmail,
  isStrictBusinessEmailModeEnabled,
} from "../Utils/emailPolicy.utils.js";
import { maybeDeleteBootstrapCredentialsFile } from "../Utils/bootstrapCredentials.utils.js";
import { purgeExpiredSoftDeletedAdminsIfDue } from "./adminLifecycle.service.js";

const router = express.Router();

const hasWhitespace = (value) => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code === 9 || code === 10 || code === 11 || code === 12 || code === 13 || code === 32) {
      return true;
    }
  }
  return false;
};

// 📧 Validate only email format so business domains can authenticate
function isValidEmail(email) {
  const normalized = String(email || "").trim().toLowerCase();
  if (!normalized || hasWhitespace(normalized)) return false;

  const atIndex = normalized.indexOf("@");
  if (atIndex <= 0 || atIndex !== normalized.lastIndexOf("@")) return false;

  const domain = normalized.slice(atIndex + 1);
  const dotIndex = domain.indexOf(".");
  return dotIndex > 0 && dotIndex < domain.length - 1;
}

const formatRestoreDeadline = (value) => {
  if (!value) return null;
  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
};

// 🚪 POST /auth  → LOGIN ONLY
router.post("/", async (req, res) => {
  const {
    type,
    email,
    password,
    validateOnly,
    formNonce,
    captchaNonce,
    captchaId,
    captcha: captchaText
  } = req.body;

  const errors = [];

  // ❌ Only login allowed
  if (type !== "login") {
    return res.status(400).json({
      success: false,
      message: "Invalid request type.",
      errors: ["Invalid request type."],
    });
  }

  if (typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid input types.",
      errors: ["Missing or invalid input types."],
    });
  }

  const trimmedEmail = email.trim().toLowerCase();
  const trimmedPassword = password.trim();

  if (!trimmedEmail) {
    errors.push("Email is required.");
  } else if (!isValidEmail(trimmedEmail)) {
    errors.push("Invalid email address.");
  } else if (
    isStrictBusinessEmailModeEnabled() &&
    isPersonalEmail(trimmedEmail)
  ) {
    errors.push(BUSINESS_EMAIL_REQUIRED_MESSAGE);
  }

  if (!trimmedPassword) {
    errors.push("Password is required.");
  }

  // 💬 Validation-only mode
  if (validateOnly) {
    return res.status(200).json({
      valid: errors.length === 0,
      errors,
    });
  }

  // ❌ Validation errors
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: errors[0],
      errors,
    });
  }

  try {
    // 🔐 CAPTCHA validation
    const normalizedFormNonce =
      typeof formNonce === "string" ? formNonce.trim() : "";
    const normalizedCaptchaNonce =
      typeof captchaNonce === "string" ? captchaNonce.trim() : "";
    const normalizedCaptchaId =
      typeof captchaId === "string" ? captchaId.trim() : "";
    const normalizedCaptchaText =
      typeof captchaText === "string" ? captchaText.trim() : "";

    if (
      !normalizedFormNonce ||
      !normalizedCaptchaNonce ||
      !normalizedCaptchaId ||
      !normalizedCaptchaText
    ) {
      return res.status(400).json({
        success: false,
        message: "Captcha verification required.",
        errors: ["Captcha verification required."],
      });
    }

    const challengeResult = await verifyCaptchaChallenge({
      formNonce: normalizedFormNonce,
      captchaNonce: normalizedCaptchaNonce,
      captchaId: normalizedCaptchaId,
      userInput: normalizedCaptchaText,
    });

    if (!challengeResult.ok) {
      return res.status(400).json({
        success: false,
        code: challengeResult.code || "CAPTCHA_VERIFICATION_FAILED",
        message: challengeResult.message || "Captcha verification failed.",
        errors: [challengeResult.message || "Captcha verification failed."],
      });
    }

    // 🔐 LOGIN FLOW
    const MAX_ATTEMPTS = 5;
    const LOCK_MINUTES = 30;

    await purgeExpiredSoftDeletedAdminsIfDue();

    const user = await loginUser(trimmedEmail);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
        errors: ["Invalid credentials."],
      });
    }

    if (user.account_status === USER_ACCOUNT_STATUSES.BLOCKED) {
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_BLOCKED",
        message: "Account is blocked by super admin. Please contact support.",
        errors: ["Account is blocked by super admin."],
      });
    }

    if (user.account_status === USER_ACCOUNT_STATUSES.DELETED) {
      const restoreUntil = formatRestoreDeadline(user.hard_delete_at);
      const deletedMessage = restoreUntil
        ? `Account has been soft-deleted by super admin. It can be restored until ${restoreUntil}.`
        : "Account has been soft-deleted by super admin.";
      return res.status(403).json({
        success: false,
        code: "ACCOUNT_SOFT_DELETED",
        message: deletedMessage,
        errors: [deletedMessage],
        restoreUntil,
      });
    }

    // 🚫 Already locked
    if (user.lock_until && new Date(user.lock_until) > new Date()) {
      const lockUntil = new Date(user.lock_until);
      const remainingMs = lockUntil - new Date();
      const remainingMinutes = Math.ceil(remainingMs / 60000);

      return res.status(403).json({
        success: false,
        message: `Account locked. Try again in ${remainingMinutes} minute(s).`,
        errors: ["Account temporarily locked due to too many failed attempts."],
        lock_info: {
          lock_until: lockUntil,
          remaining_ms: remainingMs
        }
      });
    }

    const passwordMatches = await comparePassword(user, trimmedPassword);

    if (!passwordMatches) {
      const newAttempts = (user.failed_attempts || 0) + 1;
      let lockUntil = null;

      if (newAttempts >= MAX_ATTEMPTS) {
        lockUntil = new Date(Date.now() + LOCK_MINUTES * 60 * 1000);
        await updateFailedAttempts(user.user_id, 0, lockUntil);

        return res.status(403).json({
          success: false,
          message: `Account locked due to too many failed attempts. Try again in ${LOCK_MINUTES} minutes.`,
          errors: ["Account locked."],
          lock_info: {
            lock_until: lockUntil,
            remaining_ms: LOCK_MINUTES * 60 * 1000
          }
        });
      }

      await updateFailedAttempts(user.user_id, newAttempts, null);
      const attemptsLeft = MAX_ATTEMPTS - newAttempts;

      return res.status(401).json({
        success: false,
        message: `Invalid credentials. ${attemptsLeft} attempt(s) remaining before lock.`,
        errors: ["Invalid credentials."],
        attempts_info: {
          attempts_used: newAttempts,
          attempts_left: attemptsLeft,
          max_attempts: MAX_ATTEMPTS
        }
      });
    }

    // ✅ Success
    await updateFailedAttempts(user.user_id, 0, null);
    const role = user.role || "admin";
    const onboarding = user.onboarding || {
      mustChangePassword: Boolean(user.must_change_password),
      mustUpdateProfile: !user.profile_id,
      mustShareLocation:
        Number(user.location_consent) !== 1 ||
        user.location_lat === null ||
        typeof user.location_lat === "undefined" ||
        user.location_lng === null ||
        typeof user.location_lng === "undefined",
      required:
        Boolean(user.must_change_password) ||
        !user.profile_id ||
        Number(user.location_consent) !== 1 ||
        user.location_lat === null ||
        typeof user.location_lat === "undefined" ||
        user.location_lng === null ||
        typeof user.location_lng === "undefined",
    };
    maybeDeleteBootstrapCredentialsFile({ role, onboarding });

    const token = await res.generateToken({
      user_id: user.user_id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      role,
      onboarding_required: onboarding.required,
    });

    return res.json({
      success: true,
      message: "Login successful.",
      user: {
        user_id: user.user_id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role,
        onboarding,
      },
      onboarding,
      token,
    });

  } catch (err) {
    console.error("Auth error:", err);

    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
      errors: ["Server error. Please try again later."],
    });
  }
});

export default router;
