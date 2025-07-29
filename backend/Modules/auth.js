import express from "express";
import bcrypt from "bcrypt";
import { findUserByEmail, createUser } from "./models/User.js";
import { generateToken } from "../Utils/jwt.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { type, email, password, fullName } = req.body;

  if (!type || !email || !password || (type === "register" && !fullName)) {
    return res.status(400).json({ success: false, message: "Missing required fields." });
  }

  const sanitizedEmail = email.trim().toLowerCase();

  try {
    const existingUser = await findUserByEmail(sanitizedEmail);

    if (type === "register") {
      if (existingUser) {
        return res.status(400).json({ success: false, message: "User already exists." });
      }

      const newUser = await createUser({ fullName, email: sanitizedEmail, password });
      const token = generateToken({ email: sanitizedEmail, fullName });

      return res.json({
        success: true,
        message: "Registration successful.",
        user: { email: sanitizedEmail, fullName },
        token,
      });
    }

    if (type === "login") {
      if (!existingUser) {
        return res.status(404).json({ success: false, message: "User not found." });
      }

      const isMatch = await bcrypt.compare(password, existingUser.password);

      if (!isMatch) {
        return res.status(401).json({ success: false, message: "Invalid credentials." });
      }

      const token = generateToken({ email: sanitizedEmail, fullName: existingUser.fullName });

      return res.json({
        success: true,
        message: "Login successful.",
        user: { email: sanitizedEmail, fullName: existingUser.fullName },
        token,
      });
    }

    return res.status(400).json({ success: false, message: "Invalid request type." });

  } catch (err) {
    console.error("Auth error:", err);
    return res.status(500).json({ success: false, message: "Server error." });
  }
});

export default router;
