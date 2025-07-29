import bcrypt from 'bcrypt';
import { initDatabase } from './DB.js';

const db = await initDatabase();

// ✅ Normalize helper to ensure consistency
const normalizeEmail = (email) => email.trim().toLowerCase();

// 🔍 Find user by email from DB
export const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const [rows] = await db.execute(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );

  return rows[0] || null;
};

// 🛠️ Create a new user in DB
export const createUser = async ({ fullName, email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const hashedPassword = await bcrypt.hash(password, 10);

  const [result] = await db.execute(
    'INSERT INTO users (fullName, email, password) VALUES (?, ?, ?)',
    [fullName, normalizedEmail, hashedPassword]
  );

  return {
    id: result.insertId,
    fullName,
    email: normalizedEmail
  };
};
