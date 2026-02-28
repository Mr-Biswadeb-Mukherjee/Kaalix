import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import { getDatabase } from "../Connectors/DB.js";

export const USER_ROLES = Object.freeze({
  SA: "sa",
  ADMIN: "admin",
});

const allowedRoles = new Set(Object.values(USER_ROLES));

// 🧼 Normalize email for consistent matching
export const normalizeEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
};

export const normalizeRole = (role) => {
  if (typeof role !== "string") return USER_ROLES.ADMIN;
  const normalized = role.trim().toLowerCase();
  if (normalized === "super_admin") return USER_ROLES.SA;
  return normalized;
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

export class InvalidUserRoleError extends Error {
  constructor(message = "Invalid role. Allowed roles: sa, admin.") {
    super(message);
    this.name = "InvalidUserRoleError";
    this.code = "INVALID_ROLE";
    this.status = 400;
  }
}

export class SuperAdminExistsError extends Error {
  constructor(message = "A sa user already exists.") {
    super(message);
    this.name = "SuperAdminExistsError";
    this.code = "SUPER_ADMIN_EXISTS";
    this.status = 409;
  }
}

export const normalizeOnboardingState = (state = {}) => {
  const mustChangePassword = Boolean(state.must_change_password);
  const mustUpdateProfile = !state.profile_id;
  return {
    mustChangePassword,
    mustUpdateProfile,
    required: mustChangePassword || mustUpdateProfile,
  };
};

// 🔍 Internal helper: Fetch user by email
export const findUserByEmail = async (email) => {
  const db = await getDatabase();
  const normalizedEmail = normalizeEmail(email);
  const [rows] = await db.execute(
    "SELECT * FROM users WHERE email = ? LIMIT 1",
    [normalizedEmail]
  );
  return rows[0] || null;
};

// 🔑 Public: Fetch user by ID
export const findUserById = async (userId) => {
  const db = await getDatabase();
  const [rows] = await db.execute(
    "SELECT * FROM users WHERE user_id = ? LIMIT 1",
    [userId]
  );
  return rows[0] || null;
};

export const getUserOnboardingState = async (userId) => {
  const db = await getDatabase();
  const [rows] = await db.execute(
    `SELECT
        u.user_id AS user_id,
        u.must_change_password AS must_change_password,
        p.profile_id AS profile_id
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE u.user_id = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [userId]
  );

  const identity = rows[0];
  if (!identity) return null;
  return normalizeOnboardingState(identity);
};

// 🛠️ Public: Register user
export const registerUser = async ({
  fullName,
  email,
  password,
  role = USER_ROLES.ADMIN,
}) => {
  const db = await getDatabase();
  const existing = await findUserByEmail(email);
  if (existing) throw new UserExistsError();
  const normalizedRole = normalizeRole(role);
  if (!allowedRoles.has(normalizedRole)) {
    throw new InvalidUserRoleError();
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    if (normalizedRole === USER_ROLES.SA) {
      const [superAdminRows] = await conn.execute(
        "SELECT user_id FROM users WHERE role = ? LIMIT 1 FOR UPDATE",
        [USER_ROLES.SA]
      );
      if (superAdminRows.length > 0) {
        throw new SuperAdminExistsError();
      }
    }

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
      "INSERT INTO users (user_id, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?)",
      [userId, normalizeEmail(email), hashedPassword, normalizedRole, 1]
    );

    await conn.execute(
      "INSERT INTO profiles (user_id, profile_id, fullName) VALUES (?, ?, ?)",
      [userId, null, fullName]
    );

    await conn.commit();
    return {
      user_id: userId,
      profile_id: null,
      fullName,
      email: normalizeEmail(email),
      role: normalizedRole,
    };
  } catch (err) {
    await conn.rollback();
    if (
      err?.message?.includes("Only one sa is allowed") ||
      err?.message?.includes("ux_single_super_admin")
    ) {
      throw new SuperAdminExistsError();
    }
    throw err;
  } finally {
    conn.release();
  }
};

// 🔐 Public: Login (fetch only, don’t enforce lockout here)
export const loginUser = async (email) => {
  const db = await getDatabase();
  const normalizedEmail = normalizeEmail(email);
  const [rows] = await db.execute(
    `SELECT
        u.*,
        p.fullName AS fullName,
        p.profile_id AS profile_id
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE u.email = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [normalizedEmail]
  );

  if (!rows[0]) return null;
  const user = rows[0];
  return {
    ...user,
    onboarding: normalizeOnboardingState(user),
  };
};

// 🔑 Compare password safely
export const comparePassword = async (user, plainPassword) => {
  return bcrypt.compare(plainPassword, user.password);
};

// 🔄 Update failed attempts + lock_until
export const updateFailedAttempts = async (userId, failedAttempts, lockUntil) => {
  const db = await getDatabase();
  await db.execute(
    "UPDATE users SET failed_attempts = ?, lock_until = ? WHERE user_id = ?",
    [failedAttempts, lockUntil, userId]
  );
};
