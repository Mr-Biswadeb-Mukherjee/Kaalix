// ChangePassword.js
import bcrypt from "bcrypt";
import { findUserById, updateUserPassword } from "./user.service.js";

export const ChangePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.user_id; // comes from auth middleware

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }
    if (!oldPassword || !newPassword) {
      return res
        .status(400)
        .json({ message: "Both old and new passwords are required" });
    }
    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    await updateUserPassword(userId, newPassword);

    return res.json({ message: "Password changed successfully" });
  } catch (err) {
    console.error("❌ Change password error:", err.message);
    return res
      .status(500)
      .json({ message: err.message || "Failed to change password" });
  }
};
