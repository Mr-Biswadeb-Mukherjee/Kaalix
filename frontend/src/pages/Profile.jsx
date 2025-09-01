import React, { useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import { useToast } from '../Components/Toast';   // ✅ Toast hook
import Security from '../Components/Security'; // Import Security component
import './Styles/Profile.css';

const Profile = () => {
  const { addToast } = useToast();

  const [isEditing, setIsEditing] = useState(false);
  const [userInfo, setUserInfo] = useState({
    username: 'johnny_d',
    email: 'johndoe@example.com',
    phone: '+1 234 567 890',
  });

  const [avatar, setAvatar] = useState(null);
  const [tempAvatar, setTempAvatar] = useState(null);
  const [editorRef, setEditorRef] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // For avatar source selection
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // ✅ Centralized Toast Notifications (only for profile-related)
  const notify = {
    profileUpdated: () => addToast('Profile information updated successfully!', 'success'),
    avatarUpdated: () => addToast('Profile picture has been updated!', 'success'),
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setUserInfo((prev) => ({ ...prev, [name]: value }));
  };

  const handleEditToggle = () => {
    setIsEditing(!isEditing);
  };

  const handleSave = () => {
    let updated = false;

    if (editorRef && tempAvatar) {
      const canvas = editorRef.getImageScaledToCanvas().toDataURL();
      setAvatar(canvas);
      notify.avatarUpdated();
      updated = true;
    } else if (!editorRef && tempAvatar) {
      setAvatar(tempAvatar);
      notify.avatarUpdated();
      updated = true;
    } else {
      notify.profileUpdated();
      updated = true;
    }

    if (updated) {
      setIsEditing(false);
      setIsModalOpen(false);
      setTempAvatar(null);
      setUrlInput('');
      setShowUrlInput(false);
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setTempAvatar(reader.result);
      reader.readAsDataURL(file);
    }
  };

  // Avatar Modal handlers
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setTempAvatar(null);
    setUrlInput('');
    setShowUrlInput(false);
  };

  // Avatar zoom change
  const handleZoomChange = (e) => {
    setZoomLevel(parseFloat(e.target.value));
  };

  return (
    <div className="profile-container">

      {/* Profile Header with Avatar Integrated */}
      <div className="profile-header-with-avatar">
        {avatar ? (
          <img src={avatar} alt="User Avatar" />
        ) : (
          <div className="profile-avatar-placeholder">No Avatar</div>
        )}

        <div className="profile-info">
          <h2>{userInfo.username}</h2>
          <p>{userInfo.email}</p>
          <button className="edit-btn" onClick={handleEditToggle}>
            {isEditing ? 'Cancel' : 'Edit Profile'}
          </button>

          {isEditing && (
            <div className="avatar-selection">
              <button onClick={openModal}>Upload Avatar</button>
            </div>
          )}
        </div>
      </div>

      {/* Personal Information Section */}
      <div className="profile-section">
        <h3>Personal Information</h3>
        <div className="profile-item">
          <span>Username:</span>
          {isEditing ? (
            <input
              type="text"
              name="username"
              value={userInfo.username}
              onChange={handleChange}
            />
          ) : (
            <p>{userInfo.username}</p>
          )}
        </div>
        <div className="profile-item">
          <span>Email:</span>
          {isEditing ? (
            <input
              type="email"
              name="email"
              value={userInfo.email}
              onChange={handleChange}
            />
          ) : (
            <p>{userInfo.email}</p>
          )}
        </div>
        <div className="profile-item">
          <span>Phone:</span>
          {isEditing ? (
            <input
              type="text"
              name="phone"
              value={userInfo.phone}
              onChange={handleChange}
            />
          ) : (
            <p>{userInfo.phone}</p>
          )}
        </div>

        {isEditing && (
          <button className="edit-btn save-btn" onClick={handleSave}>
            Save Changes
          </button>
        )}
      </div>

      {/* Security Section (now imported separately) */}
      <Security useremail={userInfo.useremail} />

      {/* Modal for Avatar Editing */}
      {isModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Edit Avatar</h2>

            {/* Step 1: Choose source if no tempAvatar yet */}
            {!tempAvatar && (
              <div className="avatar-source-options">
                <button
                  className="modal-btn"
                  onClick={() => document.getElementById('avatar-file').click()}
                >
                  Upload from Device
                </button>
                <button
                  className="modal-btn"
                  onClick={() => setShowUrlInput(true)}
                >
                  Use Image URL
                </button>

                {/* Hidden file input */}
                <input
                  id="avatar-file"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                />

                {/* URL input */}
                {showUrlInput && (
                  <div className="url-input">
                    <input
                      type="text"
                      placeholder="Paste image URL here..."
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                    />
                    <button
                      className="modal-btn save-btn"
                      onClick={() => {
                        if (urlInput.trim()) {
                          setTempAvatar(urlInput.trim());
                          setShowUrlInput(false);
                        }
                      }}
                    >
                      Load Image
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Step 2: Avatar Editor */}
            {tempAvatar && (
              <>
                <AvatarEditor
                  ref={(ref) => setEditorRef(ref)}
                  image={tempAvatar}
                  width={250}
                  height={250}
                  border={20}
                  borderRadius={50}
                  color={[255, 255, 255, 0.6]}
                  scale={zoomLevel}
                />
                <div className="zoom-controls">
                  <label>Zoom:</label>
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.01"
                    value={zoomLevel}
                    onChange={handleZoomChange}
                  />
                  <span>{zoomLevel.toFixed(2)}</span>
                </div>
              </>
            )}

            <div className="modal-buttons">
              <button className="modal-btn" onClick={closeModal}>
                Cancel
              </button>
              {tempAvatar && (
                <button className="modal-btn save-btn" onClick={handleSave}>
                  Save Changes
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
