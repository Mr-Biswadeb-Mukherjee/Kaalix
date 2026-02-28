import { 
  fetchProfile as getUserProfile, 
  updateProfile as modifyUserProfile, 
  updateProfileAvatar } from "../Services/profile.service.js";
import { getUserOnboardingState } from "../Services/user.service.js";

import validator from "validator";
import sanitizeHtml from "sanitize-html";
import { parsePhoneNumberFromString } from "libphonenumber-js";

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
      org: profile.org,
      orgId: profile.orgId,
      phone: profile.phone,
      bio: profile.bio,
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
    let { fullName, email, phone, bio, org } = req.body;
    const hasFullNameField = Object.prototype.hasOwnProperty.call(req.body, "fullName");
    const hasEmailField = Object.prototype.hasOwnProperty.call(req.body, "email");
    const hasPhoneField = Object.prototype.hasOwnProperty.call(req.body, "phone");
    const hasBioField = Object.prototype.hasOwnProperty.call(req.body, "bio");
    const hasOrgField = Object.prototype.hasOwnProperty.call(req.body, "org");
    const hasAnyUpdatableField =
      hasFullNameField || hasEmailField || hasPhoneField || hasBioField || hasOrgField;

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
    if (hasOrgField && typeof org !== "string") {
      return res.status(400).json({ message: "Invalid organization." });
    }

    fullName = hasFullNameField && typeof fullName === "string" ? fullName.trim() : undefined;
    email = hasEmailField && typeof email === "string" ? email.trim().toLowerCase() : undefined;
    phone = hasPhoneField && typeof phone === "string" ? phone.trim() : undefined;
    bio = hasBioField && typeof bio === "string" ? bio.trim() : undefined;
    org = hasOrgField && typeof org === "string" ? org.trim() : undefined;

    const namePattern = /^[a-zA-Z\s.'-]{1,50}$/;
    const bioPattern = /^[a-zA-Z0-9\s.,'"\-!?()]*$/;
    const orgPattern = /^[a-zA-Z0-9\s&.,'()\-]{1,120}$/;

    if (hasFullNameField && (!fullName || !namePattern.test(fullName))) {
      return res.status(400).json({ message: "Full name contains invalid characters or exceeds 50 characters." });
    }

    if (hasEmailField && (!email || !validator.isEmail(email))) {
      return res.status(400).json({ message: "Invalid email address." });
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
      } catch (e) {
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
    if (hasOrgField && org && !orgPattern.test(org)) {
      return res.status(400).json({ message: "Organization contains invalid characters or exceeds 120 characters." });
    }

    if (hasBioField && bio) {
      bio = sanitizeHtml(bio, {
        allowedTags: [],
        allowedAttributes: {},
      });
    }
    if (hasOrgField && org) {
      org = sanitizeHtml(org, {
        allowedTags: [],
        allowedAttributes: {},
      });
    }

    const updatedProfile = await modifyUserProfile(userId, {
      fullName,
      email,
      phone: normalizedPhone,
      bio,
      org,
    });
    const onboarding = await getUserOnboardingState(userId);

    res.json({
      updatedAt: formatDateTime(updatedProfile.updatedAt),
      role: updatedProfile.role,
      profileId: updatedProfile.profileId,
      fullName: updatedProfile.fullName,
      email: updatedProfile.email,
      org: updatedProfile.org,
      orgId: updatedProfile.orgId,
      phone: updatedProfile.phone,
      bio: updatedProfile.bio,
      avatarUrl: getFullAvatarUrl(req, updatedProfile.profile_url), // ✅ fixed
      onboarding,
    });
  } catch (err) {
    console.error("Error in UpdateProfile:", err);
    if (err.code === "USER_EXISTS" || err.code === "EMAIL_EXISTS") {
      return res.status(409).json({ message: "Email already in use" });
    }
    if (err.code === "PHONE_EXISTS") {
      return res.status(409).json({ message: "Phone number already in use" });
    }
    res.status(500).json({ message: "Internal server error" });
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
