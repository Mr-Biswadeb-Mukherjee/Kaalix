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

const Profile = () => {
  const { addToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState(null);

  const [userInfo, setUserInfo] = useState({
    fullName: "",
    email: "",
    phone: "",
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
          phone: data.phone || "",
          profileId: data.profileId || "",
          bio: data.bio || "",
          createdAt: data.createdAt || "",
          updatedAt: data.updatedAt || "",
          avatarUrl: data.avatarUrl || ""
        };
        setUserInfo(profile);
        setOriginalUserInfo(profile);
      })
      .catch(() => addToast("Failed to load profile info", "error"));
  }, [token, addToast]);

  // Fetch location once
  useEffect(() => {
    if (!token) return;

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
  }, [token, phoneEdited]);

  const hasChanges = useMemo(
    () => Object.keys(originalUserInfo).some((key) => originalUserInfo[key] !== userInfo[key]),
    [originalUserInfo, userInfo]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditToggle = () => {
    if (isEditing) {
      setUserInfo({ ...originalUserInfo });
      setPhoneEdited(false);
    }
    setIsEditing(!isEditing);
  };

  const handleSave = async () => {
    if (!hasChanges) return;
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

      const updatedUserInfo = {
        ...userInfo,
        updatedAt: data.updatedAt || userInfo.updatedAt,
        fullName: data.fullName || userInfo.fullName,
        email: data.email || userInfo.email,
        phone: data.phone || userInfo.phone,
        bio: data.bio || userInfo.bio
      };

      setUserInfo(updatedUserInfo);
      setOriginalUserInfo(updatedUserInfo);
      setIsEditing(false);
      setPhoneEdited(false);
    } catch (err) {
      addToast(err.message || "Failed to save changes", "error");
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

  return (
    <div className="profile-container two-column-layout">
      {/* Left Column */}
      <div className="profile-left">
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
            <div
              className="camera-icon"
              onClick={() => {
                setIsModalOpen(true);
              }}
            >
              <CameraAltIcon fontSize="small" />
            </div>
          </div>

          <div className="profile-info">
            <h2>{userInfo.fullName || "Unknown User"}</h2>
            <p className="profile-email">{userInfo.email || "No email address"}</p>
            <p className="profile-id-badge">Profile ID: {userInfo.profileId || "N/A"}</p>
          </div>
        </div>

        <ProfileInfo
          userInfo={userInfo}
          isEditing={isEditing}
          hasChanges={hasChanges}
          defaultCountry={defaultCountry}
          setUserInfo={setUserInfo}
          setPhoneEdited={setPhoneEdited}
          handleChange={handleChange}
          handleEditToggle={handleEditToggle}
          handleSave={handleSave}
        />

        <Security useremail={userInfo.email} />
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
