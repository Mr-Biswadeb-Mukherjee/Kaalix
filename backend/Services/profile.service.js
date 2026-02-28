import { getDatabase } from "../Connectors/DB.js";
import { normalizeEmail } from "./user.service.js"; // reuse email helper
import { v4 as uuidv4 } from "uuid";
import {
  BUSINESS_EMAIL_REQUIRED_MESSAGE,
  isBusinessEmail,
  isStrictBusinessEmailModeEnabled,
} from "../Utils/emailPolicy.utils.js";

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

const mapLocationConsent = (value) => {
  if (value === null || typeof value === "undefined") return null;
  return Number(value) === 1;
};

const mapPreciseLocation = (row) => {
  const hasCoords =
    row &&
    row.location_lat !== null &&
    typeof row.location_lat !== "undefined" &&
    row.location_lng !== null &&
    typeof row.location_lng !== "undefined";

  if (!hasCoords) return null;

  return {
    latitude: Number(row.location_lat),
    longitude: Number(row.location_lng),
    accuracyMeters:
      row.location_accuracy_m === null || typeof row.location_accuracy_m === "undefined"
        ? null
        : Number(row.location_accuracy_m),
    capturedAt: row.location_captured_at || null,
    locationLabel: row.location_label || null,
  };
};

const reverseGeocodePreciseLocation = async (latitude, longitude) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&format=jsonv2&zoom=12&addressdetails=1`;
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "Kaalix/1.0 (location reverse geocoding)",
      },
      signal: controller.signal,
    });

    if (!res.ok) return null;
    const data = await res.json();
    const address = data?.address || {};

    const locality =
      address.city ||
      address.town ||
      address.village ||
      address.suburb ||
      address.county ||
      null;
    const region = address.state || address.region || null;
    const country = address.country || null;

    const parts = [locality, region, country].filter(Boolean);
    if (parts.length > 0) {
      return parts.join(", ").slice(0, 255);
    }

    if (typeof data?.display_name === "string" && data.display_name.trim()) {
      return data.display_name.trim().slice(0, 255);
    }

    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
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
        p.profile_url AS profile_url,
        p.location_consent AS locationConsent,
        p.location_lat AS location_lat,
        p.location_lng AS location_lng,
        p.location_accuracy_m AS location_accuracy_m,
        p.location_captured_at AS location_captured_at,
        p.location_label AS location_label
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
    const strictBusinessEmailMode = isStrictBusinessEmailModeEnabled();

    if (strictBusinessEmailMode && !isBusinessEmail(nextEmail)) {
      const err = new Error(BUSINESS_EMAIL_REQUIRED_MESSAGE);
      err.name = "BusinessEmailRequiredError";
      err.code = "BUSINESS_EMAIL_REQUIRED";
      err.status = 400;
      throw err;
    }

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

export const getLocationSharingConsent = async (userId) => {
  const db = await getDatabase();
  const [rows] = await db.execute(
    `SELECT p.location_consent AS locationConsent
     FROM users u
     LEFT JOIN profiles p ON u.user_id = p.user_id
     WHERE u.user_id = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [userId]
  );

  return mapLocationConsent(rows[0]?.locationConsent);
};

export const getLocationSharingState = async (userId) => {
  const db = await getDatabase();
  const [rows] = await db.execute(
    `SELECT
        p.location_consent AS locationConsent,
        p.location_lat AS location_lat,
        p.location_lng AS location_lng,
        p.location_accuracy_m AS location_accuracy_m,
        p.location_captured_at AS location_captured_at,
        p.location_label AS location_label
     FROM users u
     LEFT JOIN profiles p ON u.user_id = p.user_id
     WHERE u.user_id = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [userId]
  );

  return {
    locationConsent: mapLocationConsent(rows[0]?.locationConsent),
    preciseLocation: mapPreciseLocation(rows[0]),
  };
};

export const getLatestPreciseLocation = async (userId) => {
  const db = await getDatabase();
  const [rows] = await db.execute(
    `SELECT
        p.location_lat AS location_lat,
        p.location_lng AS location_lng,
        p.location_accuracy_m AS location_accuracy_m,
        p.location_captured_at AS location_captured_at,
        p.location_label AS location_label
     FROM users u
     LEFT JOIN profiles p ON u.user_id = p.user_id
     WHERE u.user_id = ?
     ORDER BY p.id DESC
     LIMIT 1`,
    [userId]
  );

  return mapPreciseLocation(rows[0]);
};

export const updateLocationSharingConsent = async (userId, allowLocationSharing) => {
  const db = await getDatabase();
  const conn = await db.getConnection();

  try {
    await conn.beginTransaction();

    const [[profileRow]] = await conn.execute(
      "SELECT id FROM profiles WHERE user_id = ? ORDER BY id DESC LIMIT 1 FOR UPDATE",
      [userId]
    );

    const consentValue = allowLocationSharing ? 1 : 0;
    let profileRowId = profileRow?.id || null;

    if (!profileRowId) {
      const [insertResult] = await conn.execute(
        "INSERT INTO profiles (user_id, profile_id, fullName, location_consent) VALUES (?, ?, ?, ?)",
        [userId, null, "", consentValue]
      );
      profileRowId = insertResult.insertId;
    } else {
      await conn.execute(
        "UPDATE profiles SET location_consent = ? WHERE id = ?",
        [consentValue, profileRowId]
      );
    }

    await conn.execute(
      "UPDATE users SET updated_at = NOW() WHERE user_id = ?",
      [userId]
    );

    await conn.commit();
    return allowLocationSharing;
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }
};

export const updatePreciseLocation = async (userId, { latitude, longitude, accuracyMeters }) => {
  const locationLabel = await reverseGeocodePreciseLocation(latitude, longitude);
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
        `INSERT INTO profiles
          (user_id, profile_id, fullName, location_lat, location_lng, location_accuracy_m, location_captured_at, location_label)
         VALUES (?, ?, ?, ?, ?, ?, NOW(), ?)`,
        [userId, null, "", latitude, longitude, accuracyMeters, locationLabel]
      );
      profileRowId = insertResult.insertId;
    } else {
      await conn.execute(
        `UPDATE profiles
         SET location_lat = ?,
             location_lng = ?,
             location_accuracy_m = ?,
             location_captured_at = NOW(),
             location_label = COALESCE(?, location_label)
         WHERE id = ?`,
        [latitude, longitude, accuracyMeters, locationLabel, profileRowId]
      );
    }

    await conn.execute(
      "UPDATE users SET updated_at = NOW() WHERE user_id = ?",
      [userId]
    );

    await conn.commit();
    return getLatestPreciseLocation(userId);
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
