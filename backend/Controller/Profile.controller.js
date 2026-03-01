import { 
  fetchProfile as getUserProfile, 
  updateProfile as modifyUserProfile, 
  updateProfileAvatar,
  updateLocationSharingConsent,
  updatePreciseLocation,
  getLocationSharingConsent,
} from "../Services/profile.service.js";
import { getUserOnboardingState } from "../Services/user.service.js";
import { maybeDeleteBootstrapCredentialsFile } from "../Utils/bootstrapCredentials.utils.js";

import validator from "validator";
import sanitizeHtml from "sanitize-html";
import { parsePhoneNumberFromString } from "libphonenumber-js";
import {
  BUSINESS_EMAIL_REQUIRED_MESSAGE,
  isPersonalEmail,
  isStrictBusinessEmailModeEnabled,
} from "../Utils/emailPolicy.utils.js";

// Utility to format date
const formatDateTime = (date) => {
  const d = new Date(date);
  const time = d.toLocaleTimeString("en-GB", { hour12: false });
  const formattedDate = d.toLocaleDateString("en-GB");
  return `${time} ${formattedDate}`;
};

// ✅ Utility to build full URL for avatar
const getFullAvatarUrl = (req, profileUrl) => {
  if (!profileUrl) return null;
  return `${req.protocol}://${req.get("host")}${profileUrl}`;
};

const normalizeLocationConsent = (value) => {
  if (value === null || typeof value === "undefined") return null;
  return Number(value) === 1 || value === true;
};

/**
 * GET profile
 */
export const FetchProfile = async (req, res) => {
  try {
    const userId = req.user.user_id; // from JWT middleware
    const profile = await getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json({
      createdAt: formatDateTime(profile.createdAt),
      updatedAt: formatDateTime(profile.updatedAt),
      role: profile.role,
      profileId: profile.profileId,
      fullName: profile.fullName,
      email: profile.email,
      org: profile.orgName || profile.org || null,
      orgName: profile.orgName || profile.org || null,
      orgId: profile.orgId,
      orgWebsite: profile.orgWebsite || null,
      orgEmail: profile.orgEmail || null,
      orgSa: profile.orgSa || null,
      phone: profile.phone,
      bio: profile.bio,
      websiteUrl: profile.websiteUrl || null,
      locationConsent: normalizeLocationConsent(profile.locationConsent),
      avatarUrl: getFullAvatarUrl(req, profile.profile_url), // ✅ fixed
      onboarding: req.onboarding || null,
    });
  } catch (err) {
    console.error("Error in FetchProfile:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST update profile info (name, email, phone, bio)
 */
export const UpdateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let { fullName, email, phone, bio, websiteUrl, org, orgName, orgWebsite, orgEmail } = req.body;
    const hasFullNameField = Object.prototype.hasOwnProperty.call(req.body, "fullName");
    const hasEmailField = Object.prototype.hasOwnProperty.call(req.body, "email");
    const hasPhoneField = Object.prototype.hasOwnProperty.call(req.body, "phone");
    const hasBioField = Object.prototype.hasOwnProperty.call(req.body, "bio");
    const hasWebsiteUrlField = Object.prototype.hasOwnProperty.call(req.body, "websiteUrl");
    const hasOrgField = Object.prototype.hasOwnProperty.call(req.body, "org");
    const hasOrgNameField = Object.prototype.hasOwnProperty.call(req.body, "orgName");
    const hasOrgWebsiteField = Object.prototype.hasOwnProperty.call(req.body, "orgWebsite");
    const hasOrgEmailField = Object.prototype.hasOwnProperty.call(req.body, "orgEmail");
    const hasNormalizedOrgNameField = hasOrgNameField || hasOrgField;

    if (!hasOrgNameField && hasOrgField) {
      orgName = org;
    }

    const hasAnyUpdatableField =
      hasFullNameField ||
      hasEmailField ||
      hasPhoneField ||
      hasBioField ||
      hasWebsiteUrlField ||
      hasNormalizedOrgNameField ||
      hasOrgWebsiteField ||
      hasOrgEmailField;

    if (!hasAnyUpdatableField) {
      return res.status(400).json({ message: "No profile fields provided for update." });
    }

    if (hasFullNameField && typeof fullName !== "string") {
      return res.status(400).json({ message: "Invalid full name." });
    }
    if (hasEmailField && typeof email !== "string") {
      return res.status(400).json({ message: "Invalid email address." });
    }
    if (hasPhoneField && typeof phone !== "string") {
      return res.status(400).json({ message: "Invalid phone number format." });
    }
    if (hasBioField && typeof bio !== "string") {
      return res.status(400).json({ message: "Invalid bio." });
    }
    if (hasWebsiteUrlField && typeof websiteUrl !== "string") {
      return res.status(400).json({ message: "Invalid website URL." });
    }
    if (hasNormalizedOrgNameField && typeof orgName !== "string") {
      return res.status(400).json({ message: "Invalid organization." });
    }
    if (hasOrgWebsiteField && typeof orgWebsite !== "string") {
      return res.status(400).json({ message: "Invalid organization website." });
    }
    if (hasOrgEmailField && typeof orgEmail !== "string") {
      return res.status(400).json({ message: "Invalid organization email." });
    }

    fullName = hasFullNameField && typeof fullName === "string" ? fullName.trim() : undefined;
    email = hasEmailField && typeof email === "string" ? email.trim().toLowerCase() : undefined;
    phone = hasPhoneField && typeof phone === "string" ? phone.trim() : undefined;
    bio = hasBioField && typeof bio === "string" ? bio.trim() : undefined;
    websiteUrl =
      hasWebsiteUrlField && typeof websiteUrl === "string" ? websiteUrl.trim() : undefined;
    orgName =
      hasNormalizedOrgNameField && typeof orgName === "string" ? orgName.trim() : undefined;
    orgWebsite =
      hasOrgWebsiteField && typeof orgWebsite === "string" ? orgWebsite.trim() : undefined;
    orgEmail = hasOrgEmailField && typeof orgEmail === "string" ? orgEmail.trim().toLowerCase() : undefined;

    const namePattern = /^[a-zA-Z\s.'-]{1,50}$/;
    const bioPattern = /^[a-zA-Z0-9\s.,'"\-!?()]*$/;
    const orgPattern = /^[a-zA-Z0-9\s&.,'()\-]{1,120}$/;

    if (hasFullNameField && (!fullName || !namePattern.test(fullName))) {
      return res.status(400).json({ message: "Full name contains invalid characters or exceeds 50 characters." });
    }

    if (hasEmailField && (!email || !validator.isEmail(email))) {
      return res.status(400).json({ message: "Invalid email address." });
    }
    if (hasEmailField && isStrictBusinessEmailModeEnabled() && isPersonalEmail(email)) {
      return res.status(400).json({ message: BUSINESS_EMAIL_REQUIRED_MESSAGE });
    }

    let normalizedPhone = undefined;
    if (hasPhoneField && phone) {
      try {
        let parsed = parsePhoneNumberFromString(phone);

        if ((!parsed || !parsed.isValid()) && phone.match(/^\d+$/)) {
          const defaultRegion = process.env.DEFAULT_PHONE_REGION || "US";
          parsed = parsePhoneNumberFromString(phone, defaultRegion);
        }

        if (!parsed || !parsed.isValid()) {
          return res.status(400).json({ message: "Invalid phone number." });
        }

        normalizedPhone = parsed.number;
      } catch {
        return res.status(400).json({ message: "Invalid phone number format." });
      }
    } else if (hasPhoneField) {
      normalizedPhone = "";
    }

    if (hasBioField && bio && bio.length > 2000) {
      return res.status(400).json({ message: "Bio cannot exceed 2000 characters." });
    }
    if (hasBioField && bio && !bioPattern.test(bio)) {
      return res.status(400).json({ message: "Bio contains invalid characters." });
    }
    if (hasWebsiteUrlField && websiteUrl) {
      const validWebsiteUrl = validator.isURL(websiteUrl, {
        require_protocol: false,
        protocols: ["http", "https"],
        allow_protocol_relative_urls: false,
      });
      if (!validWebsiteUrl) {
        return res.status(400).json({ message: "Invalid website URL." });
      }
    }
    if (hasNormalizedOrgNameField && orgName && !orgPattern.test(orgName)) {
      return res.status(400).json({ message: "Organization contains invalid characters or exceeds 120 characters." });
    }
    if (hasOrgWebsiteField && orgWebsite) {
      const validOrgWebsite = validator.isURL(orgWebsite, {
        require_protocol: false,
        protocols: ["http", "https"],
        allow_protocol_relative_urls: false,
      });
      if (!validOrgWebsite) {
        return res.status(400).json({ message: "Invalid organization website URL." });
      }
    }
    if (hasOrgEmailField && orgEmail && !validator.isEmail(orgEmail)) {
      return res.status(400).json({ message: "Invalid organization email." });
    }
    if (hasBioField && bio) {
      bio = sanitizeHtml(bio, {
        allowedTags: [],
        allowedAttributes: {},
      });
    }
    if (hasNormalizedOrgNameField && orgName) {
      orgName = sanitizeHtml(orgName, {
        allowedTags: [],
        allowedAttributes: {},
      });
    }

    const updatedProfile = await modifyUserProfile(userId, {
      fullName,
      email,
      phone: normalizedPhone,
      bio,
      websiteUrl,
      orgName,
      orgWebsite,
      orgEmail,
    });
    const onboarding = await getUserOnboardingState(userId);
    maybeDeleteBootstrapCredentialsFile({ role: updatedProfile.role, onboarding });

    res.json({
      updatedAt: formatDateTime(updatedProfile.updatedAt),
      role: updatedProfile.role,
      profileId: updatedProfile.profileId,
      fullName: updatedProfile.fullName,
      email: updatedProfile.email,
      org: updatedProfile.orgName || updatedProfile.org || null,
      orgName: updatedProfile.orgName || updatedProfile.org || null,
      orgId: updatedProfile.orgId,
      orgWebsite: updatedProfile.orgWebsite || null,
      orgEmail: updatedProfile.orgEmail || null,
      orgSa: updatedProfile.orgSa || null,
      phone: updatedProfile.phone,
      bio: updatedProfile.bio,
      websiteUrl: updatedProfile.websiteUrl || null,
      locationConsent: normalizeLocationConsent(updatedProfile.locationConsent),
      avatarUrl: getFullAvatarUrl(req, updatedProfile.profile_url), // ✅ fixed
      onboarding,
    });
  } catch (err) {
    console.error("Error in UpdateProfile:", err);
    if (err.code === "USER_EXISTS" || err.code === "EMAIL_EXISTS") {
      return res.status(409).json({ message: "Email already in use" });
    }
    if (err.code === "BUSINESS_EMAIL_REQUIRED") {
      return res.status(400).json({ message: err.message || BUSINESS_EMAIL_REQUIRED_MESSAGE });
    }
    if (err.code === "PHONE_EXISTS") {
      return res.status(409).json({ message: "Phone number already in use" });
    }
    if (err.code === "ORG_NAME_REQUIRED") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "ORG_WEBSITE_EMAIL_MISMATCH") {
      return res.status(400).json({ message: err.message });
    }
    if (err.code === "ORG_UPDATE_FORBIDDEN") {
      return res.status(403).json({ message: err.message });
    }
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * POST update location sharing consent
 */
export const UpdateLocationConsent = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const hasAllowField = Object.prototype.hasOwnProperty.call(req.body, "allow");

    if (!hasAllowField || typeof req.body.allow !== "boolean") {
      return res.status(400).json({ message: "Invalid request. 'allow' must be a boolean." });
    }
    if (req.body.allow !== true) {
      return res.status(400).json({ message: "Location sharing is required and cannot be disabled." });
    }

    const locationConsent = await updateLocationSharingConsent(userId, req.body.allow);
    const onboarding = await getUserOnboardingState(userId);
    maybeDeleteBootstrapCredentialsFile({ role: req.user?.role, onboarding });
    return res.status(200).json({ success: true, locationConsent, onboarding });
  } catch (err) {
    console.error("Error in UpdateLocationConsent:", err);
    return res.status(500).json({ message: "Failed to update location consent" });
  }
};

/**
 * POST update precise device location (lat/lng/accuracy)
 */
export const UpdatePreciseLocation = async (req, res) => {
  try {
    const userId = req.user.user_id;
    const consent = await getLocationSharingConsent(userId);
    if (consent !== true) {
      return res.status(403).json({ message: "Location consent must be enabled first." });
    }

    const { latitude, longitude, accuracyMeters } = req.body || {};
    const lat = Number(latitude);
    const lng = Number(longitude);
    const hasAccuracy = !(accuracyMeters === null || typeof accuracyMeters === "undefined");
    const accuracy = hasAccuracy ? Number(accuracyMeters) : null;

    if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
      return res.status(400).json({ message: "Invalid latitude." });
    }
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
      return res.status(400).json({ message: "Invalid longitude." });
    }
    if (hasAccuracy && (!Number.isFinite(accuracy) || accuracy < 0 || accuracy > 100000)) {
      return res.status(400).json({ message: "Invalid accuracy meters." });
    }

    const preciseLocation = await updatePreciseLocation(userId, {
      latitude: lat,
      longitude: lng,
      accuracyMeters: accuracy,
    });

    const onboarding = await getUserOnboardingState(userId);
    maybeDeleteBootstrapCredentialsFile({ role: req.user?.role, onboarding });
    return res.status(200).json({ success: true, preciseLocation, onboarding });
  } catch (err) {
    console.error("Error in UpdatePreciseLocation:", err);
    return res.status(500).json({ message: "Failed to update precise location" });
  }
};

/**
 * POST upload avatar (uses multer upload middleware)
 */
export const UpdateAvatar = async (req, res) => {
  try {
    const userId = req.user.user_id;

    if (!req.processedAvatarPath) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    // ✅ Update DB using service
    const updatedUser = await updateProfileAvatar(userId, req.processedAvatarPath);

    return res.json({
      message: "Avatar updated successfully",
      avatarUrl: getFullAvatarUrl(req, updatedUser.profile_url),
      onboarding: req.onboarding || null,
    });
  } catch (err) {
    console.error("Error in UpdateAvatar:", err);
    return res.status(500).json({ message: "Failed to update avatar" });
  }
};
