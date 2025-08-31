import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
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

// 🔍 Internal helper: Fetch user by email (handles normalization)
const findUserByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);

  const [rows] = await db.execute(
    'SELECT * FROM users WHERE email = ? LIMIT 1',
    [normalizedEmail]
  );

  return rows[0] || null;
};

// 🛠️ Public: Register user (inserts into users + profiles)
export const registerUser = async ({ fullName, email, password }) => {
  const existing = await findUserByEmail(email);
  if (existing) {
    throw new UserExistsError();
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Generate unique user_id in the format AMON-{8hex uuid}-{YYMM}{NN}
    const hexUuid = uuidv4().replace(/-/g, '').substring(0, 8);

    const now = new Date();
    const year = String(now.getFullYear()).slice(-2); // last 2 digits
    const month = String(now.getMonth() + 1).padStart(2, '0'); // leading zero

    // Fetch last suffix for this month from DB
    const [[lastRow]] = await conn.execute(
      `SELECT user_id FROM users 
       WHERE user_id LIKE ? 
       ORDER BY user_id DESC LIMIT 1`,
      [`AMON-%-${year}${month}%`]
    );

    let nextCounter = 1; // default if none exists
    if (lastRow && lastRow.user_id) {
      const lastSuffix = lastRow.user_id.slice(-2); // last 2 digits
      nextCounter = parseInt(lastSuffix, 10) + 1;
    }

    const suffix = `${year}${month}${String(nextCounter).padStart(2, '0')}`;
    const userId = `AMON-${hexUuid}-${suffix}`;

    // Insert into users
    await conn.execute(
      'INSERT INTO users (user_id, email, password) VALUES (?, ?, ?)',
      [userId, normalizeEmail(email), hashedPassword]
    );

    // Insert into profiles
    const profileId = uuidv4();
    await conn.execute(
      `INSERT INTO profiles (user_id, profile_id, fullName) 
       VALUES (?, ?, ?)`,
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

// 🔐 Public: Login by verifying password
export const loginUser = async (email, plainPassword) => {
  const user = await findUserByEmail(email);
  if (!user) return null;

  const isMatch = await bcrypt.compare(plainPassword, user.password);
  if (!isMatch) return null;

  // Remove password before returning
  const { password, ...safeUser } = user;
  return safeUser;
};
