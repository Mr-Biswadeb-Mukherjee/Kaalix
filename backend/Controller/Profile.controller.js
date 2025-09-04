import { 
  fetchProfile as getUserProfile, 
  updateProfile as modifyUserProfile, 
  updateProfileAvatar as saveUserAvatar 
} from "../Services/user.service.js";

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
      profileId: profile.profileId,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      bio: profile.bio,
      avatarUrl: getFullAvatarUrl(req, profile.profile_url), // ✅ fixed
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
    let { fullName, email, phone, bio } = req.body;

    fullName = fullName?.trim();
    email = email?.trim().toLowerCase();
    phone = phone?.trim();
    bio = bio?.trim();

    const namePattern = /^[a-zA-Z\s.'-]{1,50}$/;
    const bioPattern = /^[a-zA-Z0-9\s.,'"\-!?()]*$/;

    if (!fullName || !namePattern.test(fullName)) {
      return res.status(400).json({ message: "Full name contains invalid characters or exceeds 50 characters." });
    }

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email address." });
    }

    let normalizedPhone = null;
    if (phone) {
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
    }

    if (bio && bio.length > 2000) {
      return res.status(400).json({ message: "Bio cannot exceed 2000 characters." });
    }
    if (bio && !bioPattern.test(bio)) {
      return res.status(400).json({ message: "Bio contains invalid characters." });
    }

    if (bio) {
      bio = sanitizeHtml(bio, {
        allowedTags: [],
        allowedAttributes: {},
      });
    }

    const updatedProfile = await modifyUserProfile(userId, {
      fullName,
      email,
      phone: normalizedPhone,
      bio,
    });

    res.json({
      updatedAt: formatDateTime(updatedProfile.updatedAt),
      fullName: updatedProfile.fullName,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      bio: updatedProfile.bio,
      avatarUrl: getFullAvatarUrl(req, updatedProfile.profile_url), // ✅ fixed
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

    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }
    // Always same filename
    const avatarUrl = `/uploads/${req.file.filename}`;

    const updatedUser = await saveUserAvatar(userId, avatarUrl);

    return res.json({
      message: "Avatar uploaded successfully",
      avatarUrl: getFullAvatarUrl(req, updatedUser.profile_url),
    });
  } catch (err) {
    console.error("Error in UpdateAvatar:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};
