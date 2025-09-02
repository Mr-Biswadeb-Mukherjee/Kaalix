import { fetchProfile as getUserProfile, updateProfile as modifyUserProfile } from "../Modules/User.js";
import validator from "validator";
import sanitizeHtml from "sanitize-html";
import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Express handler: Fetch user profile
 * Responds with { profileId, fullName, email, phone, bio, avatarUrl }
 */
export const FetchProfile = async (req, res) => {
  try {
    const userId = req.user.user_id; // from JWT middleware
    const profile = await getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    // Normalize response shape for frontend
    res.json({
      profileId: profile.profileId,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone, // already stored normalized
      bio: profile.bio,
      avatarUrl: profile.profile_url,
    });
  } catch (err) {
    console.error("Error in FetchProfile:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

/**
 * Express handler: Update user profile
 * Accepts JSON { fullName, email, phone, bio }
 * Responds with updated profile object
 */
export const UpdateProfile = async (req, res) => {
  try {
    const userId = req.user.user_id;
    let { fullName, email, phone, bio } = req.body;

    // ---- TRIM AND NORMALIZE ----
    fullName = fullName?.trim();
    email = email?.trim().toLowerCase();
    phone = phone?.trim();
    bio = bio?.trim();

    // ---- ALLOWLIST VALIDATION ----
    const namePattern = /^[a-zA-Z\s.'-]{1,50}$/;  // letters, spaces, dot, apostrophe, dash
    const bioPattern = /^[a-zA-Z0-9\s.,'"\-!?()]*$/; // letters, numbers, basic punctuation

    if (!fullName || !namePattern.test(fullName)) {
      return res.status(400).json({ message: "Full name contains invalid characters or exceeds 50 characters." });
    }

    if (!email || !validator.isEmail(email)) {
      return res.status(400).json({ message: "Invalid email address." });
    }

    // ---- PHONE VALIDATION WITH libphonenumber-js ----
    let normalizedPhone = null;
    if (phone) {
      try {
        const parsed = parsePhoneNumberFromString(phone);
        if (!parsed || !parsed.isValid()) {
          return res.status(400).json({ message: "Invalid phone number." });
        }
        normalizedPhone = parsed.number; // E.164 format: +919876543210
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

    // ---- SANITIZATION AS EXTRA LAYER ----
    if (bio) {
      bio = sanitizeHtml(bio, {
        allowedTags: [],
        allowedAttributes: {}
      });
    }

    // ---- UPDATE PROFILE ----
    const updatedProfile = await modifyUserProfile(userId, { 
      fullName, 
      email, 
      phone: normalizedPhone, 
      bio 
    });

    // ---- RESPONSE ----
    res.json({
      fullName: updatedProfile.fullName,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      bio: updatedProfile.bio,
      avatarUrl: updatedProfile.profile_url,
    });

  } catch (err) {
    console.error("Error in UpdateProfile:", err);

    // HANDLE DUPLICATE ERRORS
    if (err.code === "USER_EXISTS" || err.code === "EMAIL_EXISTS") {
      return res.status(409).json({ message: "Email already in use" });
    }
    if (err.code === "PHONE_EXISTS") {
      return res.status(409).json({ message: "Phone number already in use" });
    }

    res.status(500).json({ message: "Internal server error" });
  }
};
