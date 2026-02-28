import React, { useState } from 'react';
import { useToast } from '../UI/Toast';
import './Styles/Security.css';
import API from '@amon/shared';
import Modal from '../UI/Modal';
import { Visibility, VisibilityOff } from "@mui/icons-material";
import MFA from "./MFA"

const Security = ({ onboarding, onOnboardingUpdate }) => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility states
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const token = localStorage.getItem('token');

  const notify = {
    success: (msg) => addToast(msg, 'success'),
    error: (msg) => addToast(msg, 'error'),
    warning: (msg) => addToast(msg, 'warning'),
  };

  const handlePasswordChange = async () => {
    if (!oldPassword || !newPassword || !confirmPassword) return notify.warning('All fields are required!');
    if (newPassword !== confirmPassword) return notify.error('New password and confirmation do not match!');
    if (newPassword.length < 6) return notify.warning('Password must be at least 6 characters long!');

    try {
      setLoading(true);
      const res = await fetch(API.system.protected.changepass.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to change password');

      notify.success('Password changed successfully!');
      if (data?.onboarding && typeof onOnboardingUpdate === "function") {
        onOnboardingUpdate(data.onboarding);
      }
      setIsPasswordModalOpen(false);
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      notify.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="security-wrapper">
      <section className="security-section">
        <h3>Change Your Password</h3>
        <p>Keep your account secure by updating your password regularly.</p>
        {onboarding?.mustChangePassword && (
          <p className="security-required-note">
            Password change is required to complete first-time setup.
          </p>
        )}
        <button className="btn btn-secondary" onClick={() => setIsPasswordModalOpen(true)} disabled={loading}>
          Change Password
        </button>
      </section>
    {/* MFA Section */}
    {!onboarding?.required && <MFA />}

      {/* Password Modal */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Change Password"
        actions={
          <>
            <button className="btn btn-cancel" onClick={() => setIsPasswordModalOpen(false)} disabled={loading}>Cancel</button>
            <button className="btn btn-save" onClick={handlePasswordChange} disabled={loading}>
              {loading ? 'Applying...' : 'Apply'}
            </button>
          </>
        }
      >
        <div className="form-group password-input">
          <label>Old Password:</label>
          <div className="password-wrapper">
            <input
              type={showOldPassword ? "text" : "password"}
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
            />
            <span className="toggle-eye" onClick={() => setShowOldPassword(prev => !prev)}>
              {showOldPassword ? <VisibilityOff /> : <Visibility />}
            </span>
          </div>
        </div>

        <div className="form-group password-input">
          <label>New Password:</label>
          <div className="password-wrapper">
            <input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
            <span className="toggle-eye" onClick={() => setShowNewPassword(prev => !prev)}>
              {showNewPassword ? <VisibilityOff /> : <Visibility />}
            </span>
          </div>
        </div>

        <div className="form-group password-input">
          <label>Confirm New Password:</label>
          <div className="password-wrapper">
            <input
              type={showConfirmPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
            />
            <span className="toggle-eye" onClick={() => setShowConfirmPassword(prev => !prev)}>
              {showConfirmPassword ? <VisibilityOff /> : <Visibility />}
            </span>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default Security;
