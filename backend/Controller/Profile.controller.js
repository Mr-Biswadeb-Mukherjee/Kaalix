import { fetchProfile as getUserProfile, updateProfile as modifyUserProfile } from "../Services/user.service.js";
import validator from "validator";
import sanitizeHtml from "sanitize-html";
import { parsePhoneNumberFromString } from "libphonenumber-js";

const formatDateTime = (date) => {
  const d = new Date(date);
  const time = d.toLocaleTimeString("en-GB", { hour12: false }); 
  const formattedDate = d.toLocaleDateString("en-GB");
  return `${time} ${formattedDate}`;
};

export const FetchProfile = async (req, res) => {
  try {
    const userId = req.user.user_id; // from JWT middleware
    const profile = await getUserProfile(userId);

    if (!profile) {
      return res.status(404).json({ message: "Profile not found" });
    }

    res.json({
      createdAt: formatDateTime(profile.createdAt),
      updatedAt: formatDateTime(profile.updatedAt),   // ✅ include here
      profileId: profile.profileId,
      fullName: profile.fullName,
      email: profile.email,
      phone: profile.phone,
      bio: profile.bio,
      avatarUrl: profile.profile_url,
    });
  } catch (err) {
    console.error("Error in FetchProfile:", err);
    res.status(500).json({ message: "Internal server error" });
  }
};

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

        // If not valid, try parsing with default country fallback (e.g. 'US' or 'IN')
        if ((!parsed || !parsed.isValid()) && phone.match(/^\d+$/)) {
          const defaultRegion = process.env.DEFAULT_PHONE_REGION || "US"; // configurable fallback
          parsed = parsePhoneNumberFromString(phone, defaultRegion); // fallback to configured region
        }

        if (!parsed || !parsed.isValid()) {
          return res.status(400).json({ message: "Invalid phone number." });
        }

        normalizedPhone = parsed.number; // Always store as +E.164
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
        allowedAttributes: {}
      });
    }

    const updatedProfile = await modifyUserProfile(userId, { 
      fullName, 
      email, 
      phone: normalizedPhone, 
      bio 
    });
    res.json({
      updatedAt: formatDateTime(updatedProfile.updatedAt),
      fullName: updatedProfile.fullName,
      email: updatedProfile.email,
      phone: updatedProfile.phone,
      bio: updatedProfile.bio,
      avatarUrl: updatedProfile.profile_url,
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
