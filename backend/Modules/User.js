import bcrypt from 'bcrypt';
import { initDatabase } from '../Connectors/DB.js';

const db = await initDatabase();

// 🧼 Normalize email for consistent matching
const normalizeEmail = (email) => email.trim().toLowerCase();

// ❗ Custom error class for "user already exists"
class UserExistsError extends Error {
  constructor(message = "User already exists.") {
    super(message);
    this.name = "UserExistsError";
    this.code = "USER_EXISTS";
    this.status = 409; // HTTP Conflict
  }
}

// 🔍 Internal helper: Fetch user by email
const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const [rows] = await db.execute(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );

  return rows[0] || null;
};

// 🛠️ Public: Register user with hashing and insertion
export const registerUser = async ({ fullName, email, password }) => {
  const normalizedEmail = normalizeEmail(email);

  const existing = await findUserByEmail(normalizedEmail);
  if (existing) {
    throw new UserExistsError(); // ✅ now throwing semantic error
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const [result] = await db.execute(
    'INSERT INTO users (fullName, email, password) VALUES (?, ?, ?)',
    [fullName, normalizedEmail, hashedPassword]
  );

  return {
    id: result.insertId,
    fullName,
    email: normalizedEmail,
  };
};

// 🔐 Public: Login by verifying password
export const loginUser = async (email, plainPassword) => {
  const normalizedEmail = normalizeEmail(email);
  const user = await findUserByEmail(normalizedEmail);
  if (!user) return null;

  const isMatch = await bcrypt.compare(plainPassword, user.password);
  return isMatch ? user : null;
};
