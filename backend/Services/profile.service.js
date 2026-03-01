import { getDatabase } from "../Connectors/DB.js";
import { normalizeEmail } from "./user.service.js"; // reuse email helper
import { v4 as uuidv4 } from "uuid";
import {
  BUSINESS_EMAIL_REQUIRED_MESSAGE,
  isBusinessEmail,
  isStrictBusinessEmailModeEnabled,
} from "../Utils/emailPolicy.utils.js";

const ORG_ID_SUFFIX_LENGTH = 8;
const buildOrgSlug = (orgName = "") => {
  const slug = orgName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "org";
};
const generateOrgId = (orgName) =>
  `${buildOrgSlug(orgName)}-${uuidv4().replace(/-/g, "").slice(0, ORG_ID_SUFFIX_LENGTH).toUpperCase()}`;
const generateProfileId = () => uuidv4();

const generateUniqueOrgId = async (conn, orgName) => {
  for (let i = 0; i < 5; i += 1) {
    const candidate = generateOrgId(orgName);
    const [rows] = await conn.execute(
      "SELECT user_id FROM organizations WHERE org_id = ? LIMIT 1",
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

const getDefaultOrgSa = async (conn) => {
  const [rows] = await conn.execute(
    `SELECT
        COALESCE(NULLIF(TRIM(p.fullName), ''), u.email, u.user_id) AS sa_name
     FROM users u
     LEFT JOIN profiles p ON p.user_id = u.user_id
     WHERE u.role = 'sa'
     ORDER BY p.id DESC
     LIMIT 1`
  );
  return rows[0]?.sa_name || null;
};

const findOrganizationByOwner = async (conn, ownerUserId) => {
  const [rows] = await conn.execute(
    `SELECT
        org_id AS orgId,
        org_name AS orgName,
        org_website AS orgWebsite,
        org_email AS orgEmail,
        org_sa AS orgSa
     FROM organizations
     WHERE user_id = ?
     LIMIT 1`,
    [ownerUserId]
  );
  return rows[0] || null;
};

const findOrganizationAssignedToAdmin = async (conn, adminUserId) => {
  const [rows] = await conn.execute(
    `SELECT
        o.org_id AS orgId,
        o.org_name AS orgName,
        o.org_website AS orgWebsite,
        o.org_email AS orgEmail,
        o.org_sa AS orgSa
     FROM organization_admins oa
     INNER JOIN organizations o ON o.org_id = oa.org_id
     WHERE oa.admin_user_id = ?
     ORDER BY oa.created_at DESC, oa.id DESC
     LIMIT 1`,
    [adminUserId]
  );
  return rows[0] || null;
};

const findSuperAdminOrganization = async (conn) => {
  const [rows] = await conn.execute(
    `SELECT
        o.org_id AS orgId,
        o.org_name AS orgName,
        o.org_website AS orgWebsite,
        o.org_email AS orgEmail,
        o.org_sa AS orgSa
     FROM organizations o
     INNER JOIN users u ON u.user_id = o.user_id
     WHERE u.role = 'sa'
     ORDER BY o.updated_at DESC, o.id DESC
     LIMIT 1`
  );
  return rows[0] || null;
};

const resolveOrganizationForProfile = async (conn, { userId, role }) => {
  if (role === "sa") {
    return findOrganizationByOwner(conn, userId);
  }

  const assignedOrganization = await findOrganizationAssignedToAdmin(conn, userId);
  if (assignedOrganization) return assignedOrganization;

  const ownedOrganization = await findOrganizationByOwner(conn, userId);
  if (ownedOrganization) return ownedOrganization;

  return findSuperAdminOrganization(conn);
};

const getDomainFromEmail = (email = "") => {
  const normalized = String(email || "").trim().toLowerCase();
  const atIndex = normalized.lastIndexOf("@");
  if (atIndex <= 0 || atIndex === normalized.length - 1) return "";
  return normalized.slice(atIndex + 1).replace(/\.+$/, "");
};

const getDomainFromWebsite = (website = "") => {
  const normalized = String(website || "").trim().toLowerCase();
  if (!normalized) return "";
  const urlText = /^https?:\/\//.test(normalized) ? normalized : `https://${normalized}`;

  try {
    const hostname = new URL(urlText).hostname.replace(/\.+$/, "");
    if (!hostname) return "";
    return hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

const isOrgWebsiteEmailMatch = (website, email) => {
  const websiteDomain = getDomainFromWebsite(website);
  const emailDomain = getDomainFromEmail(email);
  if (!websiteDomain || !emailDomain) return true;
  return websiteDomain === emailDomain;
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
        p.phone AS phone,
        p.bio AS bio,
        p.website_url AS websiteUrl,
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
  const identity = rows[0] || null;
  if (!identity) return null;

  const organization = await resolveOrganizationForProfile(db, {
    userId,
    role: identity.role,
  });
  const fallbackOrgSa = await getDefaultOrgSa(db);
  const orgName = organization?.orgName || null;

  return {
    ...identity,
    orgName,
    org: orgName,
    orgId: organization?.orgId || null,
    orgWebsite: organization?.orgWebsite || null,
    orgEmail: organization?.orgEmail || null,
    orgSa: organization?.orgSa || fallbackOrgSa || null,
  };
};

// 📝 Public: Update profile
export const updateProfile = async (
  userId,
  { fullName, email, phone, bio, websiteUrl, orgName, orgWebsite, orgEmail }
) => {
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
          p.website_url AS websiteUrl,
          o.id AS orgRowId,
          o.org_name AS orgName,
          o.org_id AS orgId,
          o.org_website AS orgWebsite,
          o.org_email AS orgEmail
       FROM users u
       LEFT JOIN profiles p ON p.user_id = u.user_id
       LEFT JOIN organizations o ON o.user_id = u.user_id
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
    const hasWebsiteUrlInput = typeof websiteUrl === "string";
    const hasOrgNameInput = typeof orgName === "string";
    const hasOrgWebsiteInput = typeof orgWebsite === "string";
    const hasOrgEmailInput = typeof orgEmail === "string";
    const hasOrgInput = hasOrgNameInput || hasOrgWebsiteInput || hasOrgEmailInput;
    const hasProfileRow = Boolean(identity.profileRowId);
    const hasCustomizationInput =
      hasFullNameInput ||
      hasEmailInput ||
      hasPhoneInput ||
      hasBioInput ||
      hasWebsiteUrlInput ||
      hasOrgInput;

    const nextFullName = hasFullNameInput ? fullName : (identity.fullName ?? "");
    const nextEmail = hasEmailInput ? normalizeEmail(email) : identity.email;
    const nextPhone = hasPhoneInput ? (phone || null) : (identity.phone || null);
    const nextBio = hasBioInput ? (bio || null) : (identity.bio || null);
    const normalizedWebsiteUrl = hasWebsiteUrlInput ? websiteUrl.trim() : null;
    const nextWebsiteUrl = hasWebsiteUrlInput
      ? (normalizedWebsiteUrl || null)
      : (identity.websiteUrl || null);
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

    if (hasOrgInput && identity.role !== "sa") {
      const err = new Error("Only super admin can update organization details.");
      err.code = "ORG_UPDATE_FORBIDDEN";
      err.status = 403;
      throw err;
    }

    const normalizedOrgName = hasOrgNameInput ? orgName.trim() : null;
    const normalizedOrgWebsite = hasOrgWebsiteInput ? orgWebsite.trim() : null;
    const normalizedOrgEmail = hasOrgEmailInput ? orgEmail.trim().toLowerCase() : null;
    let orgNameValue = identity.orgName || null;
    let orgWebsiteValue = identity.orgWebsite || null;
    let orgEmailValue = identity.orgEmail || null;
    let orgIdValue = identity.orgId || null;
    let profileIdValue = identity.profileId || null;

    if (hasOrgInput) {
      if (hasOrgNameInput) {
        orgNameValue = normalizedOrgName || null;
      }
      if (hasOrgWebsiteInput) {
        orgWebsiteValue = normalizedOrgWebsite || null;
      }
      if (hasOrgEmailInput) {
        orgEmailValue = normalizedOrgEmail || null;
      }

      if (hasOrgNameInput && !normalizedOrgName) {
        orgWebsiteValue = null;
        orgEmailValue = null;
      }

      if (!orgNameValue && (orgWebsiteValue || orgEmailValue)) {
        const err = new Error("Organization name is required when saving organization details.");
        err.code = "ORG_NAME_REQUIRED";
        err.status = 400;
        throw err;
      }
      if ((hasOrgWebsiteInput || hasOrgEmailInput) && orgWebsiteValue && orgEmailValue) {
        if (!isOrgWebsiteEmailMatch(orgWebsiteValue, orgEmailValue)) {
          const err = new Error(
            "Organization website domain must match organization email domain."
          );
          err.code = "ORG_WEBSITE_EMAIL_MISMATCH";
          err.status = 400;
          throw err;
        }
      }

      if (orgNameValue) {
        const existingOrgName = identity.orgName ? identity.orgName.trim() : "";
        const orgNameChanged = hasOrgNameInput && orgNameValue !== existingOrgName;
        if (!orgIdValue || orgNameChanged) {
          orgIdValue = await generateUniqueOrgId(conn, orgNameValue);
        }
        const orgSaValue = await getDefaultOrgSa(conn);

        if (identity.orgRowId) {
          await conn.execute(
            `UPDATE organizations
             SET org_id = ?, org_name = ?, org_website = ?, org_email = ?, org_sa = ?, updated_at = NOW()
             WHERE id = ?`,
            [orgIdValue, orgNameValue, orgWebsiteValue, orgEmailValue, orgSaValue, identity.orgRowId]
          );
        } else {
          await conn.execute(
            `INSERT INTO organizations (user_id, org_id, org_name, org_website, org_email, org_sa)
             VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, orgIdValue, orgNameValue, orgWebsiteValue, orgEmailValue, orgSaValue]
          );
        }
      } else if (identity.orgRowId) {
        await conn.execute("DELETE FROM organizations WHERE id = ?", [identity.orgRowId]);
        orgIdValue = null;
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
        "UPDATE profiles SET profile_id = ?, fullName = ?, phone = ?, bio = ?, website_url = ? WHERE id = ?",
        [profileIdValue, nextFullName, nextPhone, nextBio, nextWebsiteUrl, identity.profileRowId]
      );
    } else {
      await conn.execute(
        "INSERT INTO profiles (user_id, profile_id, fullName, phone, bio, website_url) VALUES (?, ?, ?, ?, ?, ?)",
        [userId, profileIdValue, nextFullName, nextPhone, nextBio, nextWebsiteUrl]
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
