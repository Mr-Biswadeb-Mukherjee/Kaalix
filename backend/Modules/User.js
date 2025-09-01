import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { initDatabase } from "../Connectors/DB.js";

const db = await initDatabase();

// 🧼 Normalize email for consistent matching
const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return '';
  return email.trim().toLowerCase();
};

// ❗ Custom error class for "user already exists"
class UserExistsError extends Error {
  constructor(message = "User already exists.") {
    super(message);
    this.name = "UserExistsError";
    this.code = "USER_EXISTS";
    this.status = 409;
  }
}

// 🔍 Internal helper: Fetch user by email (handles normalization)
export const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const [rows] = await db.execute(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [normalizedEmail]
  );

  return rows[0] || null;
};

// 🔑 Public: Fetch user by ID
export const findUserById = async (userId) => {
  const [rows] = await db.execute(
    "SELECT * FROM users WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows[0] || null;
};

// 🛠️ Public: Register user (unchanged)
export const registerUser = async ({ fullName, email, password }) => {
  const existing = await findUserByEmail(email);
  if (existing) throw new UserExistsError();

  const hashedPassword = await bcrypt.hash(password, 10);
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const hexUuid = uuidv4().replace(/-/g, "").substring(0, 8);
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const [[lastRow]] = await conn.execute(
      `SELECT user_id FROM users 
       WHERE user_id LIKE ? 
       ORDER BY user_id DESC LIMIT 1`,
      [`AMON-%-${year}${month}%`]
    );

    let nextCounter = 1;
    if (lastRow && lastRow.user_id) {
      const lastSuffix = lastRow.user_id.slice(-2);
      nextCounter = parseInt(lastSuffix, 10) + 1;
    }

    const suffix = `${year}${month}${String(nextCounter).padStart(2, "0")}`;
    const userId = `AMON-${hexUuid}-${suffix}`;

    await conn.execute(
      "INSERT INTO users (user_id, email, password) VALUES (?, ?, ?)",
      [userId, normalizeEmail(email), hashedPassword]
    );

    const profileId = uuidv4();
    await conn.execute(
      "INSERT INTO profiles (user_id, profile_id, fullName) VALUES (?, ?, ?)",
      [userId, profileId, fullName]
    );

    await conn.commit();
    return { user_id: userId, profile_id: profileId, fullName, email: normalizeEmail(email) };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// 🔐 Public: Login by verifying password
export const loginUser = async (email, plainPassword) => {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const isMatch = await bcrypt.compare(plainPassword, user.password);
  if (!isMatch) return null;

  const { password, ...safeUser } = user;
  return safeUser;
};

// 🔄 Public: Update user password
export const updateUserPassword = async (userId, newPassword) => {
  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await db.execute("UPDATE users SET password = ? WHERE user_id = ?", [hashedPassword, userId]);
  return true;
};

// 🗑️ Public: Delete user account by email + password
export const deleteacc = async (email, password) => {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // 1️⃣ Find user by email
    const user = await findUserByEmail(email);
    if (!user) throw new Error("Email does not match any account.");

    // 2️⃣ Verify password
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) throw new Error("Invalid password.");

    // 3️⃣ Delete profile first
    await conn.execute("DELETE FROM profiles WHERE user_id = ?", [user.user_id]);

    // 4️⃣ Delete user
    const [result] = await conn.execute("DELETE FROM users WHERE user_id = ?", [user.user_id]);
    if (result.affectedRows === 0) throw new Error("Failed to delete user.");

    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};
