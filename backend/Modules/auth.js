import express from "express";
import { registerUser, loginUser } from "./User.js";

const router = express.Router();

// ✅ Allowed email domains
const allowedEmailDomains = [
  "gmail.com", "yahoo.com", "outlook.com", "hotmail.com",
  "protonmail.com", "icloud.com", "zoho.com",
];

// 🧪 Basic email format regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// 🔤 Full name must be first & last, letters only
function isValidFullName(name) {
  const trimmed = name.trim();
  return (
    name === trimmed &&
    trimmed.split(/\s+/).length >= 2 &&
    /^[a-zA-Z\s]+$/.test(trimmed)
  );
}

// 📧 Validate email domain + format
function isValidEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return emailRegex.test(email) && allowedEmailDomains.includes(domain);
}

// 🔐 Password policy: strong AF
function isStrongPassword(password) {
  return (
    password.length >= 15 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

// 🚪 POST /auth
router.post("/", async (req, res) => {
  const { type, email, password, fullName, validateOnly } = req.body;

  const errors = [];

  // Basic type checks
  if (!type || typeof email !== "string" || typeof password !== "string") {
    return res.status(400).json({
      success: false,
      message: "Missing or invalid input types.",
      errors: ["Missing or invalid input types."],
    });
  }

  if (type === "register" && typeof fullName !== "string") {
    return res.status(400).json({
      success: false,
      message: "Full name is required for registration.",
      errors: ["Full name is required for registration."],
    });
  }

  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();
  const trimmedFullName = fullName?.trim();

  if (!trimmedEmail) {
    if (type === "register") {
      errors.push("Personal email is required.");
    } else {
      errors.push("Email is required.");
    }
  } else if (!isValidEmail(trimmedEmail)) {
    if (type === "register") {
      errors.push("Only personal email providers like Gmail, Yahoo, Outlook, etc. are allowed.");
    } else {
      errors.push("Invalid email address.");
    }
  }

  if (!trimmedPassword) {
    if (type === "register") {
      errors.push("Password must be at least 15 characters and include uppercase, lowercase, number, and special character.");
    } else {
      errors.push("Password is required.");
    }
  } else if (type === "register" && !isStrongPassword(trimmedPassword)) {
    errors.push("Password must be at least 15 characters and include uppercase, lowercase, number, and special character.");
  }

  // ✅ Validate full name
  if (type === "register") {
    if (!trimmedFullName) {
      errors.push("Full name is required.");
    } else if (!isValidFullName(trimmedFullName)) {
      errors.push("Full name must include first and last name with no extra spaces or symbols.");
    }
  }

  // 💬 Validation-only mode
  if (validateOnly) {
    return res.status(200).json({
      valid: errors.length === 0,
      errors,
    });
  }

  // ❌ If validation errors exist
  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: errors[0],
      errors,
    });
  }

  try {
    // 🔐 Registration
    if (type === "register") {
      const newUser = await registerUser({
        fullName: trimmedFullName,
        email: trimmedEmail,
        password: trimmedPassword,
      });

      const token = await res.generateToken({
        email: trimmedEmail,
        fullName: newUser.fullName,
      });

      return res.json({
        success: true,
        message: "Registration successful.",
        user: {
          email: trimmedEmail,
          fullName: newUser.fullName,
        },
        token,
      });
    }

    // 🔐 Login
    if (type === "login") {
      const user = await loginUser(trimmedEmail, trimmedPassword);
      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Invalid credentials.",
          errors: ["Invalid credentials."],
        });
      }

      const token = await res.generateToken({
        email: user.email,
        fullName: user.fullName,
      });

      return res.json({
        success: true,
        message: "Login successful.",
        user: {
          email: user.email,
          fullName: user.fullName,
        },
        token,
      });
    }

    // Invalid request type
    return res.status(400).json({
      success: false,
      message: "Invalid request type.",
      errors: ["Invalid request type."],
    });
  } catch (err) {
  // ✅ Skip console.error for expected, known errors
      if (err.code !== "USER_EXISTS") {
        console.error("Auth error:", err); // Only logs unexpected issues
      }

      // 🎯 Handle known user conflict
      if (err.code === "USER_EXISTS" || err.name === "UserExistsError") {
        return res.status(409).json({
          success: false,
          message: err.message,
          errors: [err.message],
        });
      }

  // ❌ Default internal server error
  return res.status(500).json({
    success: false,
    message: "Server error. Please try again later.",
    errors: ["Server error. Please try again later."],
  });
}

});

export default router;
