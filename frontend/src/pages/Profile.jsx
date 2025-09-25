// Profile.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useToast } from '../Components/Toast';
import { Button, TextField } from "@mui/material";
import CloudUploadIcon from "@mui/icons-material/CloudUpload";
import LinkIcon from "@mui/icons-material/Link";
import Security from '../Components/Security';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css';
import './Styles/Profile.css';
import SafeImage from '../Components/safeImage';
import API from '@amon/shared';
import CameraAltIcon from "@mui/icons-material/CameraAlt";
import Cropper from "react-easy-crop";

const Profile = () => {
  const { addToast } = useToast();
  const [isEditing, setIsEditing] = useState(false);
  const [phoneEdited, setPhoneEdited] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalStep, setModalStep] = useState("choice"); // choice | device | url | preview
  const [urlInput, setUrlInput] = useState("");
  const [selectedImage, setSelectedImage] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState(null);

  // cropper states
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null);

  const [userInfo, setUserInfo] = useState({
    fullName: '',
    email: '',
    phone: '',
    profileId: '',
    bio: '',
    createdAt: '',
    updatedAt: '',
    avatarUrl: ''   // backend will send this
  });
  const [originalUserInfo, setOriginalUserInfo] = useState({ ...userInfo });
  const [defaultCountry, setDefaultCountry] = useState('us');
  const [location, setLocation] = useState('Unknown Location');
  const token = localStorage.getItem('token');

  // --- helper to crop ---
  const getCroppedImg = async (imageSrc, cropPixels) => {
    const image = new Image();
    image.src = imageSrc;
    await new Promise((resolve) => { image.onload = resolve; });

    const canvas = document.createElement("canvas");
    canvas.width = cropPixels.width;
    canvas.height = cropPixels.height;
    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      image,
      cropPixels.x,
      cropPixels.y,
      cropPixels.width,
      cropPixels.height,
      0,
      0,
      cropPixels.width,
      cropPixels.height
    );

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const fileUrl = URL.createObjectURL(blob);
        resolve({ blob, fileUrl });   // return both blob and preview URL
      }, "image/jpeg");
    });
  };


  // Fetch profile on mount
  useEffect(() => {
    if (!token) return;
    fetch(API.system.protected.getprofile.endpoint, {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}` 
      },
    })
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then(data => {
        const profile = {
          fullName: data.fullName || '',
          email: data.email || '',
          phone: data.phone || '',
          profileId: data.profileId || '',
          bio: data.bio || '',
          createdAt: data.createdAt || '',
          updatedAt: data.updatedAt || '',
          avatarUrl: data.avatarUrl || ''  // <- from backend
        };
        setUserInfo(profile);
        setOriginalUserInfo(profile);
      })
      .catch(() => addToast('Failed to load profile info', 'error'));
  }, [token, addToast]);

  // Fetch location once
  useEffect(() => {
    if (!token) return;
    const countryISOMap = { 'United States': 'us', India: 'in', 'United Kingdom': 'gb', Australia: 'au' };
    const fetchLocation = async () => {
      try {
        const res = await fetch(API.system.protected.status.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to fetch location');
        const data = await res.json();
        const loc = data?.stats?.location || 'Unknown Location';
        setLocation(loc);
        if (countryISOMap[loc] && !phoneEdited) {
          setDefaultCountry(countryISOMap[loc]);
        }
      } catch {
        setLocation('Unknown Location');
      }
    };
    fetchLocation();
  }, [token, phoneEdited]);

  const hasChanges = useMemo(
    () => Object.keys(originalUserInfo).some(key => originalUserInfo[key] !== userInfo[key]),
    [originalUserInfo, userInfo]
  );

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo(prev => ({ ...prev, [name]: value }));
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
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          updatedAt: userInfo.updatedAt,
          fullName: userInfo.fullName,
          email: userInfo.email,
          phone: userInfo.phone,
          bio: userInfo.bio
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.message || 'Something went wrong', 'error');
        return;
      }
      addToast('Profile information updated successfully!', 'success');
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
      addToast(err.message || 'Failed to save changes', 'error');
    }
  };

  const getInitials = (name) => {
    if (!name) return 'NA';
    return name.split(' ').filter(Boolean).map(n => n[0]).join('').toUpperCase();
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
                src={
                  avatarPreview ||
                  (userInfo.avatarUrl ? `${userInfo.avatarUrl}?t=${Date.now()}` : null)
                }
                alt="Profile Avatar"
                className="profile-avatar"
                fallback={
                  <span className="avatar-initials">
                    {getInitials(userInfo.fullName)}
                  </span>
                }
              />
            ) : (
              <span className="avatar-initials">{getInitials(userInfo.fullName)}</span>
            )}
          </div>
          <div 
            className="camera-icon"
            onClick={() => {
              setIsModalOpen(true);
              setModalStep("choice");
            }}
          >
            <CameraAltIcon fontSize="small" />
          </div>
        </div>

          <div className="profile-info">
            <h2>{userInfo.fullName}</h2>
            <p>{userInfo.email}</p>
            <p>Profile ID: {userInfo.profileId}</p>
          </div>
        </div>

        <div className="profile-section">
          <h3>Personal Information</h3>
          {/* name */}
          <div className="profile-item">
            <span>Name:</span>
            {isEditing ? (
              <input type="text" name="fullName" value={userInfo.fullName} onChange={handleChange} />
            ) : (<p>{userInfo.fullName}</p>)}
          </div>
          {/* email */}
          <div className="profile-item">
            <span>Email:</span>
            {isEditing ? (
              <input type="email" name="email" value={userInfo.email} onChange={handleChange} />
            ) : (<p>{userInfo.email}</p>)}
          </div>
          {/* phone */}
          <div className="profile-item">
            <span>Phone:</span>
            {isEditing ? (
              <PhoneInput
                country={defaultCountry}
                value={userInfo.phone}
                onChange={(value) => {
                  setUserInfo(prev => ({ ...prev, phone: value.startsWith('+') ? value : `+${value}` }));
                  setPhoneEdited(true);
                }}
                enableSearch
                placeholder="Enter phone number"
                containerClass="phone-input-container"
                inputClass="phone-input-field"
                buttonClass="phone-input-flag"
              />
            ) : (<p>{userInfo.phone}</p>)}
          </div>
          {/* bio */}
          <div className="profile-item">
            <span>Bio:</span>
            {isEditing ? (
              <textarea
                name="bio"
                value={userInfo.bio}
                onChange={handleChange}
                placeholder="Tell us something about yourself..."
                rows={4}
                style={{ width: '100%' }}
              />
            ) : (
              <div className="bio-display"><p>{userInfo.bio || 'No bio available'}</p></div>
            )}
          </div>
          {/* actions */}
          <div className="profile-actions">
            {!isEditing && <button className="edit-btn" onClick={handleEditToggle}>Edit</button>}
            {isEditing && (
              <>
                <button className="edit-btn cancel-btn" onClick={handleEditToggle}>Cancel</button>
                <button className="edit-btn save-btn" onClick={handleSave} disabled={!hasChanges}>Save Changes</button>
              </>
            )}
          </div>
        </div>
        <Security useremail={userInfo.email} />
      </div>

      {/* Right Column */}
      <div className="profile-right">
        <div className="widget-card">
          <h3>Recent Activity</h3>
          <ul><li>Logged in from {location}</li></ul>
        </div>
        <div className="widget-card">
          <h3>Account Status</h3>
          <h4>Created-At: {userInfo.createdAt}</h4>
          <h4>Updated-At: {userInfo.updatedAt}</h4>
          <h4>Last login: Today</h4>
        </div>
      </div>

      {/* Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Update Profile Picture</h2>

            {modalStep === "choice" && (
              <div className="upload-choice-icons" style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                {/* Upload from Device */}
                <div className="icon-option" onClick={() => setModalStep("device")} style={{ cursor: 'pointer', textAlign: 'center' }}>
                  <CloudUploadIcon style={{ fontSize: '50px', color: '#007bff' }} />
                  <p style={{ marginTop: '8px', fontWeight: 500 }}>Upload from Device</p>
                </div>
                {/* Upload from URL */}
                <div className="icon-option" onClick={() => setModalStep("url")} style={{ cursor: 'pointer', textAlign: 'center' }}>
                  <LinkIcon style={{ fontSize: '50px', color: '#28a745' }} />
                  <p style={{ marginTop: '8px', fontWeight: 500 }}>Upload from URL</p>
                </div>
              </div>
            )}

            {modalStep === "device" && (
              <div className="upload-device">
              <input 
                type="file" 
                accept="image/*" 
                id="fileUpload" 
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files[0];
                  if (file) {
                    // ✅ Ensure it's an image
                    if (!file.type.startsWith("image/")) {
                      addToast("Only image files are allowed!", "error");
                      e.target.value = ""; // reset file input
                      return;
                    }

                    const fileUrl = URL.createObjectURL(file);
                    setSelectedImage(fileUrl);
                    setModalStep("preview");
                  }
                }}
              />
                <label htmlFor="fileUpload"><Button variant="contained" component="span">Choose File</Button></label>
                <Button variant="text" onClick={() => setModalStep("choice")}>← Back</Button>
              </div>
            )}

            {modalStep === "url" && (
              <div className="upload-url">
                <TextField
                  fullWidth label="Image URL" variant="outlined"
                  value={urlInput} onChange={(e) => setUrlInput(e.target.value)}
                />
                <div style={{ marginTop: "15px" }}>
                <Button 
                  variant="contained" 
                  onClick={() => {
                    if (urlInput.trim()) {
                      const lowerUrl = urlInput.toLowerCase();
                      // ✅ basic validation for common formats
                      if (!lowerUrl.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
                        addToast("Please enter a valid image URL!", "error");
                        return;
                      }

                      setSelectedImage(urlInput);
                      setModalStep("preview");
                    }
                  }}
                >
                  Upload
                </Button>
                  <Button variant="text" onClick={() => setModalStep("choice")}>← Back</Button>
                </div>
              </div>
            )}

            {modalStep === "preview" && (
              <div className="preview-wrapper">
                <div className="preview-container">
                  <Cropper
                    image={selectedImage}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={(val) => setZoom(Number(val))}
                    onCropComplete={(croppedArea, croppedAreaPixels) => {
                      setCroppedAreaPixels(croppedAreaPixels);
                    }}
                  />
                </div>

                {/* Controls placed BELOW the cropper */}
                <div className="preview-controls">
                  <input
                    type="range"
                    min={1}
                    max={3}
                    step={0.1}
                    value={zoom}
                    onChange={(e) => setZoom(Number(e.target.value))}
                  />

                  <div className="preview-buttons">
                  <button
                    className="save-btn"
                    onClick={async () => {
                      if (!croppedAreaPixels) return;
                      const { blob, fileUrl } = await getCroppedImg(selectedImage, croppedAreaPixels);

                      const formData = new FormData();
                      formData.append("avatar", blob, "avatar.jpg");

                      try {
                        const res = await fetch(API.system.protected.updateavatar.endpoint, {
                          method: "POST",
                          headers: { Authorization: `Bearer ${token}` }, // ❌ do NOT set Content-Type, fetch sets it automatically
                          body: formData
                        });

                        if (!res.ok) throw new Error("Upload failed");
                        const data = await res.json();

                        addToast("Profile picture updated successfully!", "success");

                        // Update frontend state
                        setUserInfo(prev => ({ ...prev, avatarUrl: `${data.avatarUrl}?t=${Date.now()}`}));
                        setAvatarPreview(`${data.avatarUrl}?t=${Date.now()}`);
                      } catch (err) {
                        addToast(err.message || "Failed to upload avatar", "error");
                      }

                      setIsModalOpen(false);
                    }}
                  >
                    Save
                  </button>
                    <button
                      className="cancel-btn"
                      onClick={() => setModalStep("choice")}
                    >
                      ← Back
                    </button>
                  </div>
                </div>
              </div>
            )}


            <div className="modal-actions">
              <Button onClick={() => setIsModalOpen(false)}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
