// ProfileInfoSection.jsx
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import "./Styles/Profile.css";

const ProfileInfo = ({
  userInfo,
  isEditing,
  hasChanges,
  defaultCountry,
  setUserInfo,
  setPhoneEdited,
  handleChange,
  handleEditToggle,
  handleSave,
}) => {
  return (
    <div className="profile-section">
      <h3>Personal Information</h3>

      {/* name */}
      <div className="profile-item">
        <span>Name</span>
        {isEditing ? (
          <input
            className="profile-input"
            type="text"
            name="fullName"
            value={userInfo.fullName}
            onChange={handleChange}
          />
        ) : (
          <p>{userInfo.fullName || "Not set"}</p>
        )}
      </div>

      {/* email */}
      <div className="profile-item">
        <span>Email</span>
        {isEditing ? (
          <input
            className="profile-input"
            type="email"
            name="email"
            value={userInfo.email}
            onChange={handleChange}
          />
        ) : (
          <p>{userInfo.email || "Not set"}</p>
        )}
      </div>

      {/* phone */}
      <div className="profile-item">
        <span>Phone</span>
        {isEditing ? (
          <PhoneInput
            country={defaultCountry}
            value={userInfo.phone}
            onChange={(value) => {
              setUserInfo((prev) => ({
                ...prev,
                phone: value.startsWith("+") ? value : `+${value}`,
              }));
              setPhoneEdited(true);
            }}
            enableSearch
            placeholder="Enter phone number"
            containerClass="phone-input-container"
            inputClass="phone-input-field"
            buttonClass="phone-input-flag"
          />
        ) : (
          <p>{userInfo.phone || "Not set"}</p>
        )}
      </div>

      {/* bio */}
      <div className="profile-item">
        <span>Bio</span>
        {isEditing ? (
          <textarea
            className="profile-textarea"
            name="bio"
            value={userInfo.bio}
            onChange={handleChange}
            placeholder="Tell us something about yourself..."
            rows={4}
          />
        ) : (
          <div className="bio-display">
            <p>{userInfo.bio || "No bio available"}</p>
          </div>
        )}
      </div>

      {/* actions */}
      <div className="profile-actions">
        {!isEditing && (
          <button className="edit-btn" onClick={handleEditToggle}>
            Edit Profile
          </button>
        )}
        {isEditing && (
          <>
            <button className="cancel-btn" onClick={handleEditToggle}>
              Cancel
            </button>
            <button
              className="save-btn"
              onClick={handleSave}
              disabled={!hasChanges}
            >
              Save Changes
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default ProfileInfo;
