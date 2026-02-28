import express from "express";
import {
  loginUser,
  comparePassword,
  updateFailedAttempts
} from "./user.service.js";

import { verifyCaptcha, getStoredCaptcha } from "./captcha.service.js";

const router = express.Router();

// ✅ Allowed email domains
const allowedEmailDomains = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "protonmail.com", "icloud.com", "zoho.com",
];

// 📧 Basic email format regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 📧 Validate email domain + format
function isValidEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return emailRegex.test(email) && allowedEmailDomains.includes(domain);
}

// 🚪 POST /auth  → LOGIN ONLY
router.post("/", async (req, res) => {
  const {
    type,
    email,
    password,
    validateOnly,
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

  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();

  if (!trimmedEmail) {
    errors.push("Email is required.");
  } else if (!isValidEmail(trimmedEmail)) {
    errors.push("Invalid email address.");
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
    if (!captchaId || !captchaText) {
      return res.status(400).json({
        success: false,
        message: "Captcha verification required.",
        errors: ["Captcha verification required."],
      });
    }

    const storedCaptcha = await getStoredCaptcha(captchaId);
    const captchaValid = await verifyCaptcha(captchaId, captchaText);

    if (!captchaValid) {
      if (
        typeof storedCaptcha === "string" &&
        typeof captchaText === "string" &&
        storedCaptcha.toLowerCase() === captchaText.toLowerCase()
      ) {
        return res.status(400).json({
          success: false,
          message: "Captcha verification failed due to case sensitivity.",
          errors: [
            "Captcha is case-sensitive. Please enter it exactly as shown.",
          ],
        });
      }

      return res.status(400).json({
        success: false,
        message: "Captcha verification failed.",
        errors: ["Captcha verification failed. Please try again."],
      });
    }

    // 🔐 LOGIN FLOW
    const MAX_ATTEMPTS = 5;
    const LOCK_MINUTES = 30;

    const user = await loginUser(trimmedEmail);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials.",
        errors: ["Invalid credentials."],
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
      required: Boolean(user.must_change_password) || !user.profile_id,
    };

    const token = await res.generateToken({
      user_id: user.user_id,
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
