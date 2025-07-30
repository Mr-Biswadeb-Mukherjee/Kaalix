import express from "express";
import { findUserByEmail, createUser } from "./User.js";
import bcrypt from "bcrypt";

const router = express.Router();

// Allowed email domains
const allowedEmailDomains = [
  "gmail.com",
  "yahoo.com",
  "outlook.com",
  "hotmail.com",
  "protonmail.com",
  "icloud.com",
  "zoho.com",
];

// Email format regex (basic check)
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Full name must be two words, no leading/trailing spaces, only letters
function isValidFullName(name) {
  const trimmed = name.trim();
  return (
    name === trimmed &&
    trimmed.split(/\s+/).length >= 2 &&
    /^[a-zA-Z\s]+$/.test(trimmed)
  );
}

// Email must be valid format and from allowed domains
function isValidEmail(email) {
  const domain = email.split("@")[1]?.toLowerCase();
  return emailRegex.test(email) && allowedEmailDomains.includes(domain);
}

// Password must be at least 15 characters, with upper, lower, number, and special char
function isStrongPassword(password) {
  return (
    password.length >= 15 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
}

router.post("/", async (req, res) => {
  const { type, email, password, fullName } = req.body;

  // Basic presence and type check
  if (
    !type ||
    typeof email !== "string" ||
    typeof password !== "string" ||
    (type === "register" && typeof fullName !== "string")
  ) {
    return res
      .status(400)
      .json({ success: false, message: "Missing or invalid input types." });
  }

  // Trim inputs
  const trimmedEmail = email.trim();
  const trimmedPassword = password.trim();
  const trimmedFullName = fullName?.trim();

  // Reject empty trimmed strings
  if (
    trimmedEmail === "" ||
    trimmedPassword === "" ||
    (type === "register" && (!trimmedFullName || trimmedFullName === ""))
  ) {
    return res.status(400).json({
      success: false,
      message: "All fields must be filled. Empty values are not allowed.",
    });
  }

  // Email format + domain
  if (!isValidEmail(trimmedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Invalid or unsupported email address.",
    });
  }

  try {
    const existingUser = await findUserByEmail(trimmedEmail);

    if (type === "register") {
      // Name validation
      if (!isValidFullName(trimmedFullName)) {
        return res.status(400).json({
          success: false,
          message:
            "Full name must include at least first and last name with no extra spaces or symbols.",
        });
      }

      // Password validation
      if (!isStrongPassword(trimmedPassword)) {
        return res.status(400).json({
          success: false,
          message:
            "Password must be at least 15 characters and include uppercase, lowercase, number, and special character.",
        });
      }

      // Check duplicate user
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: "User already exists.",
        });
      }

      // Create user
      const newUser = await createUser({
        fullName: trimmedFullName,
        email: trimmedEmail,
        password: trimmedPassword,
      });

      const token = res.generateToken({
        email: trimmedEmail,
        fullName: newUser.fullName,
      });

      return res.json({
        success: true,
        message: "Registration successful.",
        user: { email: trimmedEmail, fullName: newUser.fullName },
        token,
      });
    }

    if (type === "login") {
      // User must exist
      if (!existingUser) {
        return res
          .status(404)
          .json({ success: false, message: "User not found." });
      }

      // Password match check
      const isMatch = await bcrypt.compare(
        trimmedPassword,
        existingUser.password
      );

      if (!isMatch) {
        return res
          .status(401)
          .json({ success: false, message: "Invalid credentials." });
      }

      const token = res.generateToken({
        email: trimmedEmail,
        fullName: existingUser.fullName,
      });

      return res.json({
        success: true,
        message: "Login successful.",
        user: { email: trimmedEmail, fullName: existingUser.fullName },
        token,
      });
    }

    return res
      .status(400)
      .json({ success: false, message: "Invalid request type." });
  } catch (err) {
    console.error("Auth error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error. Please try again later.",
    });
  }
});

export default router;
