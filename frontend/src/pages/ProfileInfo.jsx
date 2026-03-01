// ProfileInfoSection.jsx
import PhoneInput from "react-phone-input-2";
import "react-phone-input-2/lib/style.css";
import "./Styles/Profile.css";

const ProfileInfo = ({
  userInfo,
  onboardingRequired,
  isPersonalEditing,
  isOrgEditing,
  hasPersonalChanges,
  hasOrgChanges,
  defaultCountry,
  setUserInfo,
  setPhoneEdited,
  handleChange,
  handlePersonalEditToggle,
  handleOrgEditToggle,
  handleSavePersonal,
  handleSaveOrg,
  businessEmailError,
}) => {
  return (
    <>
      <div className="profile-section">
        <h3>Personal Information</h3>
        {onboardingRequired && (
          <p className="profile-setup-note">Complete all required setup steps on this page to continue.</p>
        )}

        <div className="profile-item">
          <span>Name</span>
          {isPersonalEditing ? (
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

        <div className="profile-item">
          <span>Email</span>
          {isPersonalEditing ? (
            <div>
              <input
                className="profile-input"
                type="email"
                name="email"
                value={userInfo.email}
                onChange={handleChange}
              />
              {businessEmailError && (
                <p className="input-error-message">{businessEmailError}</p>
              )}
            </div>
          ) : (
            <p>{userInfo.email || "Not set"}</p>
          )}
        </div>

        <div className="profile-item">
          <span>Phone</span>
          {isPersonalEditing ? (
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

        <div className="profile-item">
          <span>Bio</span>
          {isPersonalEditing ? (
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

        <div className="profile-item">
          <span>Website URL</span>
          {isPersonalEditing ? (
            <input
              className="profile-input"
              type="url"
              name="websiteUrl"
              value={userInfo.websiteUrl || ""}
              onChange={handleChange}
              placeholder="https://example.com"
            />
          ) : (
            <p>{userInfo.websiteUrl || "Not set"}</p>
          )}
        </div>

        <div className="profile-actions">
          {!isPersonalEditing && (
            <button className="edit-btn" onClick={handlePersonalEditToggle}>
              Edit Personal
            </button>
          )}
          {isPersonalEditing && (
            <>
              <button className="cancel-btn" onClick={handlePersonalEditToggle}>
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleSavePersonal}
                disabled={!hasPersonalChanges || Boolean(businessEmailError)}
              >
                Save Personal
              </button>
            </>
          )}
        </div>
      </div>

      <div className="profile-section">
        <h3>Organization Information</h3>

        <div className="profile-item">
          <span>Organization Name</span>
          {isOrgEditing ? (
            <input
              className="profile-input"
              type="text"
              name="orgName"
              value={userInfo.orgName || ""}
              onChange={handleChange}
              placeholder="Enter organization name"
            />
          ) : (
            <p>{userInfo.orgName || "Not set"}</p>
          )}
        </div>

        <div className="profile-item">
          <span>Organization Website</span>
          {isOrgEditing ? (
            <input
              className="profile-input"
              type="text"
              name="orgWebsite"
              value={userInfo.orgWebsite || ""}
              onChange={handleChange}
              placeholder="https://example.com"
            />
          ) : (
            <p>{userInfo.orgWebsite || "Not set"}</p>
          )}
        </div>

        <div className="profile-item">
          <span>Organization Email</span>
          {isOrgEditing ? (
            <input
              className="profile-input"
              type="email"
              name="orgEmail"
              value={userInfo.orgEmail || ""}
              onChange={handleChange}
              placeholder="team@example.com"
            />
          ) : (
            <p>{userInfo.orgEmail || "Not set"}</p>
          )}
        </div>

        <div className="profile-item">
          <span>Organization SA (Auto)</span>
          <p>{userInfo.orgSa || "Not set"}</p>
        </div>

        <div className="profile-item">
          <span>Organization ID</span>
          <p>
            {userInfo.orgId ||
              "Will be generated after organization details are saved"}
          </p>
        </div>

        <div className="profile-actions">
          {!isOrgEditing && (
            <button className="edit-btn" onClick={handleOrgEditToggle}>
              Edit Organization
            </button>
          )}
          {isOrgEditing && (
            <>
              <button className="cancel-btn" onClick={handleOrgEditToggle}>
                Cancel
              </button>
              <button
                className="save-btn"
                onClick={handleSaveOrg}
                disabled={!hasOrgChanges}
              >
                Save Organization
              </button>
            </>
          )}
        </div>
      </div>
    </>
  );
};

export default ProfileInfo;
