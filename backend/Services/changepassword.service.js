import bcrypt from "bcrypt";
import { getDatabase } from "../Connectors/DB.js";
import { findUserById, getUserOnboardingState } from "./user.service.js";
import { maybeDeleteBootstrapCredentialsFile } from "../Utils/bootstrapCredentials.utils.js";

/**
 * Service: Update user password
 */
const updateUserPassword = async (userId, newPassword) => {
  const db = await getDatabase();
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.execute(
    "UPDATE users SET password = ?, must_change_password = 0, updated_at = NOW() WHERE user_id = ?",
    [hashedPassword, userId]
  );
  return true;
};

/**
 * Controller: Change Password
 */
export const ChangePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;
    const userId = req.user?.user_id; // comes from auth middleware

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: user not found" });
    }

    // ✅ Validate inputs
    if (
      typeof oldPassword !== "string" ||
      typeof newPassword !== "string" ||
      !oldPassword.trim() ||
      !newPassword.trim()
    ) {
      return res.status(400).json({
        message: "Both old and new passwords must be non-empty strings",
      });
    }

    if (newPassword.length < 6) {
      return res
        .status(400)
        .json({ message: "Password must be at least 6 characters long" });
    }

    // ✅ Check user existence
    const user = await findUserById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // ✅ Verify old password
    const isMatch = await bcrypt.compare(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Old password is incorrect" });
    }

    // ✅ Update password
    await updateUserPassword(userId, newPassword);

    const onboarding = await getUserOnboardingState(userId);
    maybeDeleteBootstrapCredentialsFile({ role: user.role, onboarding });

    return res.json({
      message: "Password changed successfully",
      onboarding,
    });
  } catch (err) {
    console.error("❌ Change password error:", err.message);
    return res
      .status(500)
      .json({ message: err.message || "Failed to change password" });
  }
};
