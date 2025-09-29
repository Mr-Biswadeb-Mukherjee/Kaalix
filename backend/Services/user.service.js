import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { initDatabase } from "../Connectors/DB.js";

const db = await initDatabase();

// 🧼 Normalize email for consistent matching
export const normalizeEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
};

// ❗ Custom error class for "user already exists"
export class UserExistsError extends Error {
  constructor(message = "User already exists.") {
    super(message);
    this.name = "UserExistsError";
    this.code = "USER_EXISTS";
    this.status = 409;
  }
}

// 🔍 Internal helper: Fetch user by email
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

// 🛠️ Public: Register user
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
    return {
      user_id: userId,
      profile_id: profileId,
      fullName,
      email: normalizeEmail(email),
    };
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

// 🔐 Public: Login (fetch only, don’t enforce lockout here)
export const loginUser = async (email) => {
  const user = await findUserByEmail(email);
  if (!user) return null;
  return user; // includes failed_attempts + lock_until
};

// 🔑 Compare password safely
export const comparePassword = async (user, plainPassword) => {
  return bcrypt.compare(plainPassword, user.password);
};

// 🔄 Update failed attempts + lock_until
export const updateFailedAttempts = async (userId, failedAttempts, lockUntil) => {
  await db.execute(
    "UPDATE users SET failed_attempts = ?, lock_until = ? WHERE user_id = ?",
    [failedAttempts, lockUntil, userId]
  );
};
