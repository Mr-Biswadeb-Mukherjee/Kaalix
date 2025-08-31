import React, { useState } from 'react';
import AvatarEditor from 'react-avatar-editor';
import './Styles/Profile.css';
import { useToast } from '../Components/Toast';   // ✅ Import Toast hook

const Profile = () => {
  const { addToast } = useToast();   // ✅ Access toast

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
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [zoomLevel, setZoomLevel] = useState(1);

  // For avatar source selection
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');

  // Password Change Modal States
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete Account States
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteConfirmStep, setIsDeleteConfirmStep] = useState(false);
  const [deleteUsername, setDeleteUsername] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  // ✅ Centralized Toast Notifications
  const notify = {
    profileUpdated: () => addToast('Profile information updated successfully!', 'success'),
    avatarUpdated: () => addToast('Profile picture has been updated!', 'success'),
    passwordChanged: () => addToast('Password has been changed successfully!', 'success'),
    passwordMismatch: () => addToast('New password and confirmation do not match!', 'error'),
    passwordTooShort: () => addToast('Password must be at least 6 characters long!', 'warning'),
    accountDeleted: () => addToast('Your account has been deleted permanently!', 'success'),
    invalidDelete: () => addToast('Invalid username or password!', 'error'),
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

  // Password Modal handlers
  const openPasswordModal = () => setIsPasswordModalOpen(true);
  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Avatar zoom change
  const handleZoomChange = (e) => {
    setZoomLevel(parseFloat(e.target.value));
  };

  // Handle password change
  const handlePasswordChange = () => {
    if (newPassword !== confirmPassword) {
      notify.passwordMismatch();
      return;
    }
    if (newPassword.length < 6) {
      notify.passwordTooShort();
      return;
    }
    notify.passwordChanged();
    closePasswordModal();
  };

  // Delete Account Flow
  const openDeleteModal = () => {
    setIsDeleteModalOpen(true);
    setIsDeleteConfirmStep(false);
    setDeleteUsername('');
    setDeletePassword('');
  };

  const closeDeleteModal = () => {
    setIsDeleteModalOpen(false);
    setIsDeleteConfirmStep(false);
    setDeleteUsername('');
    setDeletePassword('');
  };

  const handleDeleteYes = () => {
    setIsDeleteConfirmStep(true);
  };

  const handleDeleteNo = () => {
    closeDeleteModal();
  };

  const handleFinalDelete = () => {
    if (deleteUsername !== userInfo.username || deletePassword.length < 6) {
      notify.invalidDelete();
      return;
    }
    notify.accountDeleted();
    closeDeleteModal();
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

      {/* Security Section */}
      <div className="profile-section">
        <h3>Security</h3>
        <button className="secondary-btn" onClick={openPasswordModal}>
          Change Password
        </button>
      </div>

      {/* Danger Zone */}
      <div className="profile-section danger-zone">
        <h3>Danger Zone</h3>
        <button className="danger-btn" onClick={openDeleteModal}>
          Delete Account
        </button>
        <button className="logout-btn">Logout</button>
      </div>

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

      {/* Modal for Password Change */}
      {isPasswordModalOpen && (
        <div className="modal">
          <div className="modal-content">
            <h2>Change Password</h2>
            <div className="password-input">
              <label>Old Password:</label>
              <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>
            <div className="password-input">
              <label>New Password:</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="password-input">
              <label>Confirm New Password:</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <div className="modal-buttons">
              <button className="modal-btn" onClick={closePasswordModal}>
                Cancel
              </button>
              <button className="modal-btn save-btn" onClick={handlePasswordChange}>
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Account Modal */}
      {isDeleteModalOpen && (
        <div className="modal">
          <div className="modal-content">
            {!isDeleteConfirmStep ? (
              <>
                <h2>Are you sure you want to delete your account?</h2>
                <p>This action is irreversible.</p>
                <div className="modal-buttons">
                  <button className="modal-btn" onClick={handleDeleteNo}>No</button>
                  <button className="modal-btn danger-btn" onClick={handleDeleteYes}>Yes</button>
                </div>
              </>
            ) : (
              <>
                <h2>Confirm Deletion</h2>
                <p>Please enter your username and password to confirm.</p>
                <div className="profile-item">
                  <span>Username:</span>
                  <input
                    type="text"
                    value={deleteUsername}
                    onChange={(e) => setDeleteUsername(e.target.value)}
                  />
                </div>
                <div className="profile-item">
                  <span>Password:</span>
                  <input
                    type="password"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                  />
                </div>
                <div className="modal-buttons">
                  <button className="modal-btn" onClick={closeDeleteModal}>Cancel</button>
                  <button className="modal-btn danger-btn" onClick={handleFinalDelete}>
                    Delete Account
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
