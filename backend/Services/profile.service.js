import { getDatabase } from "../Connectors/DB.js";
import { normalizeEmail } from "./user.service.js"; // reuse email helper
import { v4 as uuidv4 } from "uuid";

const generateOrgId = () => `ORG-${uuidv4().replace(/-/g, "").slice(0, 12).toUpperCase()}`;
const generateProfileId = () => uuidv4();

const generateUniqueOrgId = async (conn) => {
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateOrgId();
    const [rows] = await conn.execute(
      "SELECT user_id FROM profiles WHERE org_id = ? LIMIT 1",
      [candidate]
    );
    if (rows.length === 0) return candidate;
  }
  throw new Error("Failed to generate unique org id.");
};

const generateUniqueProfileId = async (conn) => {
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateProfileId();
    const [rows] = await conn.execute(
      "SELECT user_id FROM profiles WHERE profile_id = ? LIMIT 1",
      [candidate]
    );
    if (rows.length === 0) return candidate;
  }
  throw new Error("Failed to generate unique profile id.");
};

// 📂 Public: Fetch profile
export const fetchProfile = async (userId) => {
  const db = await getDatabase();
  const [rows] = await db.execute(
    `SELECT 
        u.created_at AS createdAt,
        u.updated_at AS updatedAt,
        u.role AS role,
        p.profile_id AS profileId,
        u.email AS email,
        p.fullName AS fullName,
        p.org AS org,
        p.org_id AS orgId,
        p.phone AS phone,
        p.bio AS bio,
        p.profile_url AS profile_url
     FROM users u
     LEFT JOIN profiles p ON u.user_id = p.user_id
     WHERE u.user_id = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

// 📝 Public: Update profile
export const updateProfile = async (userId, { fullName, email, phone, bio, org }) => {
  const db = await getDatabase();
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const [[identity]] = await conn.execute(
      `SELECT
          u.email AS email,
          u.role AS role,
          p.id AS profileRowId,
          p.profile_id AS profileId,
          p.fullName AS fullName,
          p.phone AS phone,
          p.bio AS bio,
          p.org AS org,
          p.org_id AS orgId
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.user_id
       WHERE u.user_id = ?
       ORDER BY p.id DESC
       LIMIT 1
       FOR UPDATE`,
      [userId]
    );

    if (!identity) {
      const err = new Error("User profile not found.");
      err.code = "PROFILE_NOT_FOUND";
      throw err;
    }

    const hasFullNameInput = typeof fullName === "string";
    const hasEmailInput = typeof email === "string";
    const hasPhoneInput = typeof phone === "string";
    const hasBioInput = typeof bio === "string";
    const hasOrgInput = typeof org === "string";
    const hasProfileRow = Boolean(identity.profileRowId);
    const hasCustomizationInput =
      hasFullNameInput || hasEmailInput || hasPhoneInput || hasBioInput || hasOrgInput;

    const nextFullName = hasFullNameInput ? fullName : (identity.fullName ?? "");
    const nextEmail = hasEmailInput ? normalizeEmail(email) : identity.email;
    const nextPhone = hasPhoneInput ? (phone || null) : (identity.phone || null);
    const nextBio = hasBioInput ? (bio || null) : (identity.bio || null);

    if (hasEmailInput) {
      const [rows] = await conn.execute(
        "SELECT user_id FROM users WHERE email = ? AND user_id != ? LIMIT 1",
        [nextEmail, userId]
      );
      if (rows.length > 0) {
        const err = new Error("Email is already in use by another account.");
        err.name = "EmailExistsError";
        err.code = "EMAIL_EXISTS";
        err.status = 409;
        throw err;
      }
    }

    if (hasPhoneInput && nextPhone) {
      const [rows] = await conn.execute(
        "SELECT user_id FROM profiles WHERE phone = ? AND user_id != ? LIMIT 1",
        [nextPhone, userId]
      );
      if (rows.length > 0) {
        const err = new Error("Phone number is already in use by another account.");
        err.name = "PhoneExistsError";
        err.code = "PHONE_EXISTS";
        err.status = 409;
        throw err;
      }
    }

    const normalizedOrg = hasOrgInput ? org.trim() : null;
    let orgValue = identity.org || null;
    let orgIdValue = identity.orgId || null;
    let profileIdValue = identity.profileId || null;

    if (identity.role === "sa") {
      if (hasOrgInput) {
        if (normalizedOrg) {
          orgValue = normalizedOrg;
          if (!orgIdValue) {
            orgIdValue = await generateUniqueOrgId(conn);
          }
        } else {
          orgValue = null;
          orgIdValue = null;
        }
      }
    }

    if (!profileIdValue && hasCustomizationInput) {
      profileIdValue = await generateUniqueProfileId(conn);
    }

    await conn.execute(
      "UPDATE users SET email = ?, updated_at = NOW() WHERE user_id = ?",
      [nextEmail, userId]
    );

    if (hasProfileRow) {
      await conn.execute(
        "UPDATE profiles SET profile_id = ?, fullName = ?, org = ?, org_id = ?, phone = ?, bio = ? WHERE id = ?",
        [profileIdValue, nextFullName, orgValue, orgIdValue, nextPhone, nextBio, identity.profileRowId]
      );
    } else {
      await conn.execute(
        "INSERT INTO profiles (user_id, profile_id, fullName, org, org_id, phone, bio) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [userId, profileIdValue, nextFullName, orgValue, orgIdValue, nextPhone, nextBio]
      );
    }

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

    const [[profileRow]] = await conn.execute(
      "SELECT id FROM profiles WHERE user_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [userId]
    );

    let profileRowId = profileRow?.id || null;
    if (!profileRowId) {
      const [insertResult] = await conn.execute(
        "INSERT INTO profiles (user_id, profile_id, fullName) VALUES (?, ?, ?)",
        [userId, null, ""]
      );
      profileRowId = insertResult.insertId;
    }

    await conn.execute("UPDATE profiles SET profile_url = ? WHERE id = ?", [avatarUrl, profileRowId]);

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
