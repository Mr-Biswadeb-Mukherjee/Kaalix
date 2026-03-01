// Profile.jsx
import { useState, useEffect, useMemo, useCallback } from "react";
import { useToast } from "../Components/UI/Toast";
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import Security from "../Components/Features/Security";
import ProfileInfo from "./ProfileInfo";
import SafeImage from "../Components/UI/safeImage";
import API from "@amon/shared";
import "react-phone-input-2/lib/style.css";
import "./Styles/Profile.css";
import ProfileAvatarModal from "./ProfileAvatarModal";
import { useAuth } from "../Context/AuthContext";
import { getBrowserLocationLabel } from "../Utils/browserLocation";
import { isWebsiteEmailDomainMatch } from "../Utils/domainUtils";
import {
  BUSINESS_EMAIL_REQUIRED_MESSAGE,
  isPersonalEmail,
  isValidEmailFormat,
} from "../Utils/businessEmailPolicy";

const Profile = () => {
  const { addToast } = useToast();
  const { onboarding, updateOnboarding } = useAuth();

  const [isPersonalEditing, setIsPersonalEditing] = useState(false);
  const [isOrgEditing, setIsOrgEditing] = useState(false);
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [userInfo, setUserInfo] = useState({
    fullName: "",
    email: "",
    role: "",
    phone: "",
    orgName: "",
    orgWebsite: "",
    orgEmail: "",
    orgSa: "",
    orgId: "",
    profileId: "",
    bio: "",
    websiteUrl: "",
    createdAt: "",
    updatedAt: "",
    avatarUrl: ""
  });

  const [originalUserInfo, setOriginalUserInfo] = useState({ ...userInfo });
  const [defaultCountry, setDefaultCountry] = useState("us");
  const [location, setLocation] = useState("Unknown Location");
  const [locationSharingEnabled, setLocationSharingEnabled] = useState(false);
  const [locationConsentRequired, setLocationConsentRequired] = useState(false);
  const [preciseLocationAvailable, setPreciseLocationAvailable] = useState(false);
  const [isLocationConsentSaving, setIsLocationConsentSaving] = useState(false);

  const token = localStorage.getItem("token");
  const applyProfileSnapshot = useCallback((snapshot) => {
    setUserInfo(snapshot);
    setOriginalUserInfo(snapshot);
  }, []);
  const applyUserInfoPatch = useCallback((patch) => {
    setUserInfo((prev) => ({ ...prev, ...patch }));
    setOriginalUserInfo((prev) => ({ ...prev, ...patch }));
  }, []);

  const fetchLocationStats = useCallback(async () => {
    if (!token) return;
    if (onboarding?.required) {
      if (onboarding?.mustShareLocation) {
        setLocation("Location permission required");
        setLocationConsentRequired(true);
      } else {
        setLocation("Complete Profile Setup");
        setLocationConsentRequired(false);
      }
      setLocationSharingEnabled(false);
      setPreciseLocationAvailable(false);
      return;
    }

    const countryISOMap = { "United States": "us", India: "in", "United Kingdom": "gb", Australia: "au" };

    try {
      const res = await fetch(API.system.protected.status.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
      });
      if (!res.ok) throw new Error("Failed to fetch location");
      const data = await res.json();
      const browserLocation = await getBrowserLocationLabel();
      const loc = browserLocation || data?.stats?.location || "Unknown Location";
      const isLocationAllowed = data?.stats?.locationSharingEnabled === true;
      const isConsentNeeded = data?.stats?.locationConsentRequired === true;
      const hasPreciseLocation = data?.stats?.preciseLocationAvailable === true;

      setLocation(loc);
      setLocationSharingEnabled(isLocationAllowed);
      setLocationConsentRequired(isConsentNeeded);
      setPreciseLocationAvailable(hasPreciseLocation);

      const countryName = loc.includes(",") ? loc.split(",").pop().trim() : loc.trim();
      if (countryISOMap[countryName] && !phoneEdited) {
        setDefaultCountry(countryISOMap[countryName]);
      }
    } catch {
      const browserLocation = await getBrowserLocationLabel();
      setLocation(browserLocation || "Unknown Location");
      setLocationSharingEnabled(false);
      setLocationConsentRequired(false);
      setPreciseLocationAvailable(false);
    }
  }, [token, onboarding?.required, onboarding?.mustShareLocation, phoneEdited]);

  // Fetch profile on mount
  useEffect(() => {
    if (!token) return;

    fetch(API.system.protected.getprofile.endpoint, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    })
      .then((res) => {
        if (!res.ok) throw new Error("Failed to fetch profile");
        return res.json();
      })
      .then((data) => {
        const profile = {
          fullName: data.fullName || "",
          email: data.email || "",
          role: data.role || "",
          phone: data.phone || "",
          orgName: data.orgName || data.org || "",
          orgWebsite: data.orgWebsite || "",
          orgEmail: data.orgEmail || "",
          orgSa: data.orgSa || "",
          orgId: data.orgId || "",
          profileId: data.profileId || "",
          bio: data.bio || "",
          websiteUrl: data.websiteUrl || "",
          createdAt: data.createdAt || "",
          updatedAt: data.updatedAt || "",
          avatarUrl: data.avatarUrl || ""
        };
        applyProfileSnapshot(profile);
        if (data?.onboarding) {
          updateOnboarding(data.onboarding);
        }
      })
      .catch(() => addToast("Failed to load profile info", "error"));
  }, [token, addToast, updateOnboarding, applyProfileSnapshot]);

  // Fetch location once
  useEffect(() => {
    fetchLocationStats();
  }, [fetchLocationStats]);

  const hasPersonalChanges = useMemo(
    () =>
      ["fullName", "email", "phone", "bio", "websiteUrl"].some(
        (key) => originalUserInfo[key] !== userInfo[key]
      ),
    [originalUserInfo, userInfo]
  );

  const hasOrgChanges = useMemo(
    () =>
      ["orgName", "orgWebsite", "orgEmail"].some(
        (key) => (originalUserInfo[key] || "") !== (userInfo[key] || "")
      ),
    [originalUserInfo, userInfo]
  );
  const businessEmailError = useMemo(() => {
    if (!isPersonalEditing) return "";
    const email = String(userInfo.email || "").trim().toLowerCase();
    if (!email || !isValidEmailFormat(email)) return "";
    return isPersonalEmail(email) ? BUSINESS_EMAIL_REQUIRED_MESSAGE : "";
  }, [isPersonalEditing, userInfo.email]);
  const canEditOrganization = userInfo.role === "sa";

  useEffect(() => {
    if (!canEditOrganization && isOrgEditing) {
      setIsOrgEditing(false);
    }
  }, [canEditOrganization, isOrgEditing]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handlePersonalEditToggle = () => {
    if (isPersonalEditing) {
      setUserInfo((prev) => ({
        ...prev,
        fullName: originalUserInfo.fullName,
        email: originalUserInfo.email,
        phone: originalUserInfo.phone,
        bio: originalUserInfo.bio,
        websiteUrl: originalUserInfo.websiteUrl
      }));
      setPhoneEdited(false);
    }
    setIsPersonalEditing((prev) => !prev);
  };

  const handleOrgEditToggle = () => {
    if (!canEditOrganization) return;
    if (isOrgEditing) {
      setUserInfo((prev) => ({
        ...prev,
        orgName: originalUserInfo.orgName,
        orgWebsite: originalUserInfo.orgWebsite,
        orgEmail: originalUserInfo.orgEmail,
        orgId: originalUserInfo.orgId
      }));
    }
    setIsOrgEditing((prev) => !prev);
  };

  const handleSavePersonal = async () => {
    if (!hasPersonalChanges) return;
    if (businessEmailError) {
      addToast(businessEmailError, "error");
      return;
    }
    try {
      const res = await fetch(API.system.protected.updateprofile.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          updatedAt: userInfo.updatedAt,
          fullName: userInfo.fullName,
          email: userInfo.email,
          phone: userInfo.phone,
          bio: userInfo.bio,
          websiteUrl: userInfo.websiteUrl
        })
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.message || "Something went wrong", "error");
        return;
      }

      addToast("Profile information updated successfully!", "success");

      const nextUpdatedAt = data.updatedAt || userInfo.updatedAt;
      const nextFullName = data.fullName || userInfo.fullName;
      const nextEmail = data.email || userInfo.email;
      const nextPhone = data.phone || userInfo.phone;
      const nextBio = data.bio || userInfo.bio;
      const nextWebsiteUrl = data.websiteUrl || "";
      const nextProfileId = data.profileId || userInfo.profileId;

      applyUserInfoPatch({
        updatedAt: nextUpdatedAt,
        fullName: nextFullName,
        email: nextEmail,
        phone: nextPhone,
        bio: nextBio,
        websiteUrl: nextWebsiteUrl,
        profileId: nextProfileId
      });
      if (data?.onboarding) {
        updateOnboarding(data.onboarding);
      }
      setIsPersonalEditing(false);
      setPhoneEdited(false);
    } catch (err) {
      addToast(err.message || "Failed to save changes", "error");
    }
  };

  const handleSaveOrg = async () => {
    if (!canEditOrganization) {
      addToast("Only super admin can edit organization details.", "error");
      return;
    }
    if (!hasOrgChanges) return;
    if (
      userInfo.orgWebsite &&
      userInfo.orgEmail &&
      !isWebsiteEmailDomainMatch(userInfo.orgWebsite, userInfo.orgEmail)
    ) {
      addToast(
        "Organization website domain and organization email domain must be the same.",
        "error"
      );
      return;
    }
    try {
      const res = await fetch(API.system.protected.updateprofile.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          updatedAt: userInfo.updatedAt,
          orgName: userInfo.orgName,
          orgWebsite: userInfo.orgWebsite,
          orgEmail: userInfo.orgEmail
        })
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.message || "Something went wrong", "error");
        return;
      }

      addToast("Organization updated successfully!", "success");

      const nextUpdatedAt = data.updatedAt || userInfo.updatedAt;
      const nextRole = data.role || userInfo.role;
      const nextOrgName = data.orgName || data.org || "";
      const nextOrgWebsite = data.orgWebsite || "";
      const nextOrgEmail = data.orgEmail || "";
      const nextOrgSa = data.orgSa || "";
      const nextOrgId = data.orgId || "";
      const nextProfileId = data.profileId || userInfo.profileId;

      applyUserInfoPatch({
        updatedAt: nextUpdatedAt,
        role: nextRole,
        orgName: nextOrgName,
        orgWebsite: nextOrgWebsite,
        orgEmail: nextOrgEmail,
        orgSa: nextOrgSa,
        orgId: nextOrgId,
        profileId: nextProfileId
      });
      if (data?.onboarding) {
        updateOnboarding(data.onboarding);
      }
      setIsOrgEditing(false);
    } catch (err) {
      addToast(err.message || "Failed to save organization", "error");
    }
  };

  const updatePreciseLocationFromDevice = async () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      addToast("Geolocation is not supported by this environment.", "error");
      return false;
    }

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(
          resolve,
          reject,
          {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 60000,
          }
        );
      });

      const res = await fetch(API.system.protected.locationUpdate.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracyMeters: position.coords.accuracy,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast(data.message || "Failed to update exact device location.", "error");
        return false;
      }

      if (data?.onboarding) {
        updateOnboarding(data.onboarding);
      }
      return true;
    } catch (err) {
      if (typeof err?.code === "number") {
        if (err.code === 1) {
          addToast("Browser denied location access. Allow it to continue.", "error");
          return false;
        }
        if (err.code === 2) {
          addToast("Unable to determine current device location.", "error");
          return false;
        }
        if (err.code === 3) {
          addToast("Location request timed out. Try again.", "error");
          return false;
        }
      }

      addToast(err.message || "Failed to capture exact location.", "error");
      return false;
    }
  };

  const handleLocationConsentUpdate = async () => {
    if (!token) return;
    if (!window.confirm("Location sharing and exact device location are required. Continue?")) {
      return;
    }

    setIsLocationConsentSaving(true);
    try {
      const res = await fetch(API.system.protected.locationConsent.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ allow: true })
      });
      const data = await res.json();

      if (!res.ok) {
        addToast(data.message || "Failed to update location sharing", "error");
        return;
      }

      if (data?.onboarding) {
        updateOnboarding(data.onboarding);
      }

      const preciseLocationSaved = await updatePreciseLocationFromDevice();
      if (!preciseLocationSaved) {
        return;
      }

      addToast("Exact device location updated.", "success");
      await fetchLocationStats();
    } catch (err) {
      addToast(err.message || "Failed to update location sharing", "error");
    } finally {
      setIsLocationConsentSaving(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return "NA";
    return name
      .split(" ")
      .filter(Boolean)
      .map((n) => n[0])
      .join("")
      .toUpperCase();
  };

  const getRoleLabel = (role) => {
    if (!role) return "N/A";
    if (role === "sa") return "SA";
    return role.toUpperCase();
  };

  return (
    <div className="profile-container two-column-layout">
      {/* Left Column */}
      <div className="profile-left">
        {onboarding?.required && (
          <div className="profile-onboarding-banner">
            Complete required setup: use a business email address, update profile details, change password, and share exact device location.
          </div>
        )}
        <div className="profile-header-with-avatar">
          <div className="profile-avatar-wrapper">
            <div className="profile-avatar-ring">
              {avatarPreview || userInfo.avatarUrl ? (
                <SafeImage
                  src={avatarPreview || `${userInfo.avatarUrl}?t=${Date.now()}`}
                  alt="Profile Avatar"
                  className="profile-avatar"
                  fallback={<span className="avatar-initials">{getInitials(userInfo.fullName)}</span>}
                />
              ) : (
                <span className="avatar-initials">{getInitials(userInfo.fullName)}</span>
              )}
            </div>
            {!onboarding?.required && (
              <div
                className="camera-icon"
                onClick={() => {
                  setIsModalOpen(true);
                }}
              >
                <CameraAltIcon fontSize="small" />
              </div>
            )}
          </div>

          <div className="profile-info">
            <h2>{userInfo.fullName || "Unknown User"}</h2>
            <p className="profile-email">{userInfo.email || "No email address"}</p>
            <p className="profile-role-badge">Role: {getRoleLabel(userInfo.role)}</p>
            <p className="profile-id-badge">Profile ID: {userInfo.profileId || "N/A"}</p>
          </div>
        </div>

        <ProfileInfo
          userInfo={userInfo}
          canEditOrganization={canEditOrganization}
          onboardingRequired={onboarding?.required}
          isPersonalEditing={isPersonalEditing}
          isOrgEditing={isOrgEditing}
          hasPersonalChanges={hasPersonalChanges}
          hasOrgChanges={hasOrgChanges}
          defaultCountry={defaultCountry}
          setUserInfo={setUserInfo}
          setPhoneEdited={setPhoneEdited}
          handleChange={handleChange}
          handlePersonalEditToggle={handlePersonalEditToggle}
          handleOrgEditToggle={handleOrgEditToggle}
          handleSavePersonal={handleSavePersonal}
          handleSaveOrg={handleSaveOrg}
          businessEmailError={businessEmailError}
        />

        <Security
          useremail={userInfo.email}
          onboarding={onboarding}
          onOnboardingUpdate={updateOnboarding}
        />
      </div>

      {/* Right Column */}
      <div className="profile-right">
        <div className="widget-card">
          <h3>Recent Activity</h3>
          <ul className="activity-list">
            <li>
              Logged in from <strong>{location}</strong>
            </li>
          </ul>
          {(onboarding?.mustShareLocation ||
            (!onboarding?.required && (
              locationConsentRequired || !locationSharingEnabled || !preciseLocationAvailable
            ))) && (
            <div className="location-consent-actions">
              <button
                type="button"
                className="save-btn"
                onClick={handleLocationConsentUpdate}
                disabled={isLocationConsentSaving || (locationSharingEnabled && preciseLocationAvailable)}
              >
                {isLocationConsentSaving
                  ? "Updating Location..."
                  : (locationSharingEnabled && preciseLocationAvailable)
                    ? "Exact Location Shared"
                    : !locationSharingEnabled
                      ? "Enable Location Sharing (Required)"
                      : "Share Exact Device Location (Required)"}
              </button>
            </div>
          )}
        </div>
        <div className="widget-card">
          <h3>Account Status</h3>
          <div className="status-list">
            <div className="status-row">
              <span>Created</span>
              <strong>{userInfo.createdAt || "N/A"}</strong>
            </div>
            <div className="status-row">
              <span>Updated</span>
              <strong>{userInfo.updatedAt || "N/A"}</strong>
            </div>
            <div className="status-row">
              <span>Last Login</span>
              <strong>Today</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Profile Avatar Modal */}
      <ProfileAvatarModal
        isModalOpen={isModalOpen}
        setIsModalOpen={setIsModalOpen}
        token={token}
        setUserInfo={setUserInfo}
        setAvatarPreview={setAvatarPreview}
      />
    </div>
  );
};

export default Profile;
