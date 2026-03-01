import { findUserByEmail } from "./user.service.js";
import { getDatabase } from "../Connectors/DB.js";
import bcrypt from "bcrypt";
import path from "path";
import { promises as fs } from "fs";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AVATAR_UPLOAD_DIR = path.resolve(__dirname, "..", "public", "uploads");

const resolveAvatarPath = (profileUrl) => {
  const normalized = String(profileUrl || "").replace(/\\/g, "/").trim();
  if (!normalized.startsWith("/uploads/")) return null;

  const fileName = path.basename(normalized);
  if (!fileName || fileName !== normalized.split("/").pop()) return null;

  const absolutePath = path.resolve(AVATAR_UPLOAD_DIR, fileName);
  if (!absolutePath.startsWith(`${AVATAR_UPLOAD_DIR}${path.sep}`)) return null;
  return absolutePath;
};

const deleteacc = async (email, password) => {
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const user = await findUserByEmail(email);
    if (!user) throw new Error("Email does not match any account.");
    if (user.role === "sa") throw new Error("SA account cannot be deleted.");

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new Error("Invalid password.");

    const [profileRows] = await conn.execute(
      "SELECT profile_url FROM profiles WHERE user_id = ? LIMIT 1",
      [user.user_id]
    );
    const profile = profileRows[0];

    if (profile?.profile_url) {
      const avatarPath = resolveAvatarPath(profile.profile_url);
      if (!avatarPath) {
        throw new Error("Invalid avatar path.");
      }

      try {
        await fs.unlink(avatarPath);
      } catch (err) {
        if (err?.code === "ENOENT") {
          // Avatar already missing; continue deleting the account.
        } else {
          throw new Error(`Failed to delete avatar file: ${err.message}`);
        }
      }
    }

    await conn.execute("DELETE FROM profiles WHERE user_id = ?", [user.user_id]);

    const [result] = await conn.execute("DELETE FROM users WHERE user_id = ?", [user.user_id]);
    if (result.affectedRows === 0) throw new Error("Failed to delete user.");

    await conn.commit();
    return user;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const DeleteAccount = async (req, res, next) => {
  try {
    const { password } = req.body;

    const authUser = req.user;
    if (!authUser || !authUser.email) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in to delete your account."
      });
    }

    const authenticatedEmail = authUser.email;
    const bodyEmail = req.body?.email;

    if (bodyEmail && bodyEmail !== authenticatedEmail) {
      return res.status(403).json({
        success: false,
        message: "You are doing wrong, You are not allowed to do so."
      });
    }

    const emailToDelete = authenticatedEmail;

    if (!password || typeof password !== "string") {
      return res.status(400).json({
        success: false,
        message: "Please enter your account password to confirm."
      });
    }

    const userRecord = await findUserByEmail(emailToDelete);
    if (!userRecord) {
      return res.status(404).json({
        success: false,
        message: "We couldn’t find an account with your email."
      });
    }

    const deletedUser = await deleteacc(emailToDelete, password);

    res.locals.deletedUserId = deletedUser.user_id;

    return res.status(200).json({
      success: true,
      message: `Hi ${deletedUser.fullName || "there"}, your account has been permanently deleted.`
    });
  } catch (err) {
    console.error("Error deleting user account:", err.message);

    if (err.message.includes("Email does not match")) {
      return res.status(404).json({
        success: false,
        message: "Hmm… the email doesn’t match our records."
      });
    }

    if (err.message.includes("Invalid password")) {
      return res.status(401).json({
        success: false,
        message: "Incorrect password. Account deletion cancelled."
      });
    }

    if (err.message.includes("SA account cannot be deleted")) {
      return res.status(403).json({
        success: false,
        message: "SA account cannot be deleted."
      });
    }

    if (err.message.includes("Failed to delete avatar file")) {
      return res.status(500).json({
        success: false,
        message: "Could not remove your profile picture. Account deletion was rolled back."
      });
    }
    return next(err);
  }
};
