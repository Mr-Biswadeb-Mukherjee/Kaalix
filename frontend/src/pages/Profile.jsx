// Profile.jsx
import React, { useState, useEffect, useMemo } from "react";
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
    org: "",
    orgId: "",
    profileId: "",
    bio: "",
    createdAt: "",
    updatedAt: "",
    avatarUrl: ""
  });

  const [originalUserInfo, setOriginalUserInfo] = useState({ ...userInfo });
  const [defaultCountry, setDefaultCountry] = useState("us");
  const [location, setLocation] = useState("Unknown Location");

  const token = localStorage.getItem("token");

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
          org: data.org || "",
          orgId: data.orgId || "",
          profileId: data.profileId || "",
          bio: data.bio || "",
          createdAt: data.createdAt || "",
          updatedAt: data.updatedAt || "",
          avatarUrl: data.avatarUrl || ""
        };
        setUserInfo(profile);
        setOriginalUserInfo(profile);
        if (data?.onboarding) {
          updateOnboarding(data.onboarding);
        }
      })
      .catch(() => addToast("Failed to load profile info", "error"));
  }, [token, addToast, updateOnboarding]);

  // Fetch location once
  useEffect(() => {
    if (!token) return;
    if (onboarding?.required) {
      setLocation("Complete Profile Setup");
      return;
    }

    const countryISOMap = { "United States": "us", India: "in", "United Kingdom": "gb", Australia: "au" };

    const fetchLocation = async () => {
      try {
        const res = await fetch(API.system.protected.status.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }
        });
        if (!res.ok) throw new Error("Failed to fetch location");
        const data = await res.json();
        const loc = data?.stats?.location || "Unknown Location";
        setLocation(loc);
        if (countryISOMap[loc] && !phoneEdited) {
          setDefaultCountry(countryISOMap[loc]);
        }
      } catch {
        setLocation("Unknown Location");
      }
    };

    fetchLocation();
  }, [token, phoneEdited, onboarding?.required]);

  const hasPersonalChanges = useMemo(
    () =>
      ["fullName", "email", "phone", "bio"].some(
        (key) => originalUserInfo[key] !== userInfo[key]
      ),
    [originalUserInfo, userInfo]
  );

  const hasOrgChanges = useMemo(
    () => originalUserInfo.org !== userInfo.org,
    [originalUserInfo, userInfo]
  );

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
        bio: originalUserInfo.bio
      }));
      setPhoneEdited(false);
    }
    setIsPersonalEditing((prev) => !prev);
  };

  const handleOrgEditToggle = () => {
    if (isOrgEditing) {
      setUserInfo((prev) => ({
        ...prev,
        org: originalUserInfo.org,
        orgId: originalUserInfo.orgId
      }));
    }
    setIsOrgEditing((prev) => !prev);
  };

  const handleSavePersonal = async () => {
    if (!hasPersonalChanges) return;
    try {
      const res = await fetch(API.system.protected.updateprofile.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          updatedAt: userInfo.updatedAt,
          fullName: userInfo.fullName,
          email: userInfo.email,
          phone: userInfo.phone,
          bio: userInfo.bio
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
      const nextProfileId = data.profileId || userInfo.profileId;

      setUserInfo((prev) => ({
        ...prev,
        updatedAt: nextUpdatedAt,
        fullName: nextFullName,
        email: nextEmail,
        phone: nextPhone,
        bio: nextBio,
        profileId: nextProfileId
      }));
      setOriginalUserInfo((prev) => ({
        ...prev,
        updatedAt: nextUpdatedAt,
        fullName: nextFullName,
        email: nextEmail,
        phone: nextPhone,
        bio: nextBio,
        profileId: nextProfileId
      }));
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
    if (!hasOrgChanges) return;
    try {
      const res = await fetch(API.system.protected.updateprofile.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          updatedAt: userInfo.updatedAt,
          org: userInfo.org
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
      const nextOrg = data.org || "";
      const nextOrgId = data.orgId || "";
      const nextProfileId = data.profileId || userInfo.profileId;

      setUserInfo((prev) => ({
        ...prev,
        updatedAt: nextUpdatedAt,
        role: nextRole,
        org: nextOrg,
        orgId: nextOrgId,
        profileId: nextProfileId
      }));
      setOriginalUserInfo((prev) => ({
        ...prev,
        updatedAt: nextUpdatedAt,
        role: nextRole,
        org: nextOrg,
        orgId: nextOrgId,
        profileId: nextProfileId
      }));
      if (data?.onboarding) {
        updateOnboarding(data.onboarding);
      }
      setIsOrgEditing(false);
    } catch (err) {
      addToast(err.message || "Failed to save organization", "error");
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
            Complete first-time setup: update profile details and change your password.
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
          isSa={userInfo.role === "sa"}
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
