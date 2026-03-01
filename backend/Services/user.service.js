import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
import validator from "validator";
import { getDatabase } from "../Connectors/DB.js";
import {
  BUSINESS_EMAIL_REQUIRED_MESSAGE,
  isBusinessEmail,
  isStrictBusinessEmailModeEnabled,
} from "../Utils/emailPolicy.utils.js";

export const USER_ROLES = Object.freeze({
  SA: "sa",
  ADMIN: "admin",
});
export const USER_ACCOUNT_STATUSES = Object.freeze({
  ACTIVE: "active",
  BLOCKED: "blocked",
  DELETED: "deleted",
});

const allowedRoles = new Set(Object.values(USER_ROLES));
const allowedAccountStatuses = new Set(Object.values(USER_ACCOUNT_STATUSES));
const USERNAME_REGEX = /^[a-z0-9](?:[a-z0-9._-]{2,31})$/;

const isLowerAlpha = (ch) => ch >= "a" && ch <= "z";
const isDigit = (ch) => ch >= "0" && ch <= "9";
const isSeparator = (ch) => ch === "-" || ch === "_" || ch === ".";
const isAllowedUsernameChar = (ch) =>
  isLowerAlpha(ch) || isDigit(ch) || isSeparator(ch);

const sanitizeUsernameLocalPart = (value = "") => {
  const normalized = String(value || "").trim().toLowerCase();

  let stageOne = "";
  let inInvalidRun = false;
  for (let i = 0; i < normalized.length; i += 1) {
    const ch = normalized[i];
    if (isAllowedUsernameChar(ch)) {
      stageOne += ch;
      inInvalidRun = false;
      continue;
    }
    if (!inInvalidRun) {
      stageOne += "-";
      inInvalidRun = true;
    }
  }

  let stageTwo = "";
  let i = 0;
  while (i < stageOne.length) {
    const ch = stageOne[i];
    if (!isSeparator(ch)) {
      stageTwo += ch;
      i += 1;
      continue;
    }

    let j = i + 1;
    while (j < stageOne.length && isSeparator(stageOne[j])) j += 1;
    const runLength = j - i;
    stageTwo += runLength === 1 ? ch : "-";
    i = j;
  }

  let start = 0;
  let end = stageTwo.length;
  while (start < end && isSeparator(stageTwo[start])) start += 1;
  while (end > start && isSeparator(stageTwo[end - 1])) end -= 1;
  return stageTwo.slice(start, end);
};

// 🧼 Normalize email for consistent matching
export const normalizeEmail = (email) => {
  if (!email || typeof email !== "string") return "";
  return email.trim().toLowerCase();
};

export const normalizeUsername = (username) => {
  if (!username || typeof username !== "string") return "";
  return username.trim().toLowerCase();
};

export const normalizeRole = (role) => {
  if (typeof role !== "string") return USER_ROLES.ADMIN;
  const normalized = role.trim().toLowerCase();
  if (normalized === "super_admin") return USER_ROLES.SA;
  return normalized;
};

const buildUsernameBaseFromEmail = (email) => {
  const localPart = String(email || "").split("@")[0] || "";
  const normalized = sanitizeUsernameLocalPart(localPart);

  if (!normalized) return "user";
  if (isLowerAlpha(normalized[0]) || isDigit(normalized[0])) {
    return normalized.slice(0, 20);
  }
  return `u${normalized}`.slice(0, 20);
};

const buildUsernameCandidate = (base, attempt) => {
  const safeBase = base || "user";
  if (attempt === 0) return safeBase.slice(0, 32);
  const suffix = String(attempt + 1);
  const maxBaseLength = Math.max(3, 32 - suffix.length - 1);
  return `${safeBase.slice(0, maxBaseLength)}-${suffix}`;
};

const generateUniqueUsername = async (conn, base) => {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = buildUsernameCandidate(base, attempt);
    if (!USERNAME_REGEX.test(candidate)) continue;
    const [rows] = await conn.execute(
      "SELECT user_id FROM users WHERE username = ? LIMIT 1",
      [candidate]
    );
    if (rows.length === 0) return candidate;
  }
  throw new InvalidUsernameError("Unable to generate a unique username.");
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

export class InvalidUsernameError extends Error {
  constructor(
    message =
      "Invalid username. Use 3-32 characters with lowercase letters, numbers, dot, underscore, or hyphen."
  ) {
    super(message);
    this.name = "InvalidUsernameError";
    this.code = "INVALID_USERNAME";
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
  const requiresBusinessEmail =
    isStrictBusinessEmailModeEnabled() && !isBusinessEmail(state.email || "");
  const mustUpdateProfile = !state.profile_id || requiresBusinessEmail;
  const hasPreciseLocation =
    state.location_lat !== null &&
    typeof state.location_lat !== "undefined" &&
    state.location_lng !== null &&
    typeof state.location_lng !== "undefined";
  const mustShareLocation = Number(state.location_consent) !== 1 || !hasPreciseLocation;
  return {
    mustChangePassword,
    mustUpdateProfile,
    mustShareLocation,
    requiresBusinessEmail,
    required: mustChangePassword || mustUpdateProfile || mustShareLocation,
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

export const findUserByUsername = async (username) => {
  const db = await getDatabase();
  const normalizedUsername = normalizeUsername(username);
  const [rows] = await db.execute(
    "SELECT * FROM users WHERE username = ? LIMIT 1",
    [normalizedUsername]
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
        u.email AS email,
        u.must_change_password AS must_change_password,
        p.profile_id AS profile_id,
        p.location_consent AS location_consent,
        p.location_lat AS location_lat,
        p.location_lng AS location_lng
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

export const getUserAccessState = async (userId) => {
  const db = await getDatabase();
  const [rows] = await db.execute(
    `SELECT
        user_id AS user_id,
        role AS role,
        COALESCE(account_status, 'active') AS account_status
     FROM users
     WHERE user_id = ?
     LIMIT 1`,
    [userId]
  );

  const state = rows[0] || null;
  if (!state) return null;
  const normalizedStatus = String(state.account_status || "").trim().toLowerCase();
  return {
    user_id: state.user_id,
    role: state.role,
    account_status: allowedAccountStatuses.has(normalizedStatus)
      ? normalizedStatus
      : USER_ACCOUNT_STATUSES.ACTIVE,
  };
};

// 🛠️ Public: Register user
export const registerUser = async ({
  username,
  fullName,
  email,
  password,
  role = USER_ROLES.ADMIN,
}) => {
  const db = await getDatabase();
  const normalizedEmail = normalizeEmail(email);
  const requestedUsername = normalizeUsername(username);

  if (!normalizedEmail || !validator.isEmail(normalizedEmail)) {
    const err = new Error("Invalid email address.");
    err.code = "INVALID_EMAIL";
    err.status = 400;
    throw err;
  }

  if (
    isStrictBusinessEmailModeEnabled() &&
    !isBusinessEmail(normalizedEmail)
  ) {
    const err = new Error(BUSINESS_EMAIL_REQUIRED_MESSAGE);
    err.code = "BUSINESS_EMAIL_REQUIRED";
    err.status = 400;
    throw err;
  }

  if (requestedUsername && !USERNAME_REGEX.test(requestedUsername)) {
    throw new InvalidUsernameError();
  }

  const existingEmail = await findUserByEmail(normalizedEmail);
  if (existingEmail) throw new UserExistsError("User already exists with this email.");

  if (requestedUsername) {
    const existingUsername = await findUserByUsername(requestedUsername);
    if (existingUsername) {
      throw new UserExistsError("User already exists with this username.");
    }
  }

  const normalizedRole = normalizeRole(role);
  if (!allowedRoles.has(normalizedRole)) {
    throw new InvalidUserRoleError();
  }
  const hashedPassword = await bcrypt.hash(password, 10);
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    let normalizedUsername = requestedUsername;

    if (normalizedRole === USER_ROLES.SA) {
      const [superAdminRows] = await conn.execute(
        "SELECT user_id FROM users WHERE role = ? LIMIT 1 FOR UPDATE",
        [USER_ROLES.SA]
      );
      if (superAdminRows.length > 0) {
        throw new SuperAdminExistsError();
      }
    }

    if (!normalizedUsername) {
      const usernameBase = buildUsernameBaseFromEmail(normalizedEmail);
      normalizedUsername = await generateUniqueUsername(conn, usernameBase);
    }

    const hexUuid = uuidv4().replace(/-/g, "").substring(0, 8);
    const now = new Date();
    const year = String(now.getFullYear()).slice(-2);
    const month = String(now.getMonth() + 1).padStart(2, "0");

    const [[lastRow]] = await conn.execute(
      `SELECT user_id FROM users 
       WHERE user_id LIKE ? 
       ORDER BY user_id DESC LIMIT 1`,
      [`KAALIX-%-${year}${month}%`]
    );

    let nextCounter = 1;
    if (lastRow && lastRow.user_id) {
      const lastSuffix = lastRow.user_id.slice(-2);
      nextCounter = parseInt(lastSuffix, 10) + 1;
    }

    const suffix = `${year}${month}${String(nextCounter).padStart(2, "0")}`;
    const userId = `KAALIX-${hexUuid}-${suffix}`;

    await conn.execute(
      "INSERT INTO users (user_id, username, email, password, role, account_status, must_change_password) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [
        userId,
        normalizedUsername,
        normalizedEmail,
        hashedPassword,
        normalizedRole,
        USER_ACCOUNT_STATUSES.ACTIVE,
        1,
      ]
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
      username: normalizedUsername,
      email: normalizedEmail,
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
export const loginUser = async (identifier) => {
  const db = await getDatabase();
  const normalizedIdentifier =
    typeof identifier === "string" ? identifier.trim().toLowerCase() : "";
  const isEmailIdentifier = normalizedIdentifier.includes("@");

  if (!normalizedIdentifier) return null;

  const lookupColumn = isEmailIdentifier ? "u.email" : "u.username";
  const [rows] = await db.execute(
    `SELECT
        u.*,
        p.fullName AS fullName,
        p.profile_id AS profile_id,
        p.location_consent AS location_consent,
        p.location_lat AS location_lat,
        p.location_lng AS location_lng
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE ${lookupColumn} = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [normalizedIdentifier]
  );

  if (!rows[0]) return null;
  const user = rows[0];
  const normalizedStatus = String(user.account_status || "").trim().toLowerCase();
  return {
    ...user,
    account_status: allowedAccountStatuses.has(normalizedStatus)
      ? normalizedStatus
      : USER_ACCOUNT_STATUSES.ACTIVE,
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
