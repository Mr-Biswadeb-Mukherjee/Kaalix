import { getDatabase } from "../Connectors/DB.js";
import { normalizeEmail } from "./user.service.js"; // reuse email helper

// 📂 Public: Fetch profile
export const fetchProfile = async (userId) => {
  const db = await getDatabase();
  const [rows] = await db.execute(
    `SELECT 
        u.created_at AS createdAt,
        u.updated_at AS updatedAt,
        p.profile_id AS profileId,
        u.email AS email,
        p.fullName AS fullName,
        p.phone AS phone,
        p.bio AS bio,
        p.profile_url AS profile_url
     FROM users u
     JOIN profiles p ON u.user_id = p.user_id
     WHERE u.user_id = ?
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

// 📝 Public: Update profile
export const updateProfile = async (userId, { fullName, email, phone, bio }) => {
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (email) {
      const normalizedEmail = normalizeEmail(email);
      const [rows] = await conn.execute(
        "SELECT user_id FROM users WHERE email = ? AND user_id != ? LIMIT 1",
        [normalizedEmail, userId]
      );
      if (rows.length > 0) {
        const err = new Error("Email is already in use by another account.");
        err.name = "EmailExistsError";
        err.code = "EMAIL_EXISTS";
        err.status = 409;
        throw err;
      }

      await conn.execute(
        "UPDATE users SET email = ?, updated_at = NOW() WHERE user_id = ?",
        [normalizedEmail, userId]
      );
    } else {
      await conn.execute(
        "UPDATE users SET updated_at = NOW() WHERE user_id = ?",
        [userId]
      );
    }

    if (phone) {
      const [rows] = await conn.execute(
        "SELECT user_id FROM profiles WHERE phone = ? AND user_id != ? LIMIT 1",
        [phone, userId]
      );
      if (rows.length > 0) {
        const err = new Error("Phone number is already in use by another account.");
        err.name = "PhoneExistsError";
        err.code = "PHONE_EXISTS";
        err.status = 409;
        throw err;
      }
    }

    await conn.execute(
      "UPDATE profiles SET fullName = ?, phone = ?, bio = ? WHERE user_id = ?",
      [fullName || null, phone || null, bio || null, userId]
    );

    await conn.commit();
    return fetchProfile(userId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// 📸 Public: Update profile avatar
export const updateProfileAvatar = async (userId, avatarUrl) => {
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    await conn.execute(
      "UPDATE profiles SET profile_url = ? WHERE user_id = ?",
      [avatarUrl, userId]
    );

    await conn.execute(
      "UPDATE users SET updated_at = NOW() WHERE user_id = ?",
      [userId]
    );

    await conn.commit();
    return fetchProfile(userId);
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
