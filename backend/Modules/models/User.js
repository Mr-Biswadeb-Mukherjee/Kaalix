import bcrypt from 'bcrypt';
import { initDatabase } from '../Database/DB.js';

const db = await initDatabase();

// Find user by email from DB
export const findUserByEmail = async (email) => {
  const [rows] = await db.execute(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [email]
  );
  return rows[0] || null;
};

// Create a new user in DB
export const createUser = async ({ fullName, email, password }) => {
  const hashedPassword = await bcrypt.hash(password, 10);

  const [result] = await db.execute(
    'INSERT INTO users (fullName, email, password) VALUES (?, ?, ?)',
    [fullName, email, hashedPassword]
  );

  // Return the inserted user with the ID
  return {
    id: result.insertId,
    fullName,
    email
  };
};
