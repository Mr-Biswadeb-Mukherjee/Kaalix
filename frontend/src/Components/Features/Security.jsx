import React, { useState, useEffect } from 'react';
import { useToast } from '../UI/Toast';
import './Styles/Security.css';
import API from '@amon/shared';
import Modal from '../UI/Modal';
import { Visibility, VisibilityOff } from "@mui/icons-material";
import MFA from "./MFA"

const Security = () => {
  const { addToast } = useToast();
  const [loading, setLoading] = useState(false);

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteConfirmStep, setIsDeleteConfirmStep] = useState(false);
  const [isDeleteSuccessModal, setIsDeleteSuccessModal] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deletePassword, setDeletePassword] = useState('');
  const [countdown, setCountdown] = useState(3); // countdown in seconds

  // Password visibility states
  const [showOldPassword, setShowOldPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showDeletePassword, setShowDeletePassword] = useState(false);

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

  const handleFinalDelete = async () => {
    if (!deleteEmail || !deletePassword) return notify.warning('All fields are required!');

    try {
      setLoading(true);
      const res = await fetch(API.system.protected.deleteacc.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: deleteEmail.trim(),
          password: deletePassword,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        data = { message: await res.text() };
      }

      if (!res.ok) throw new Error(data.message || 'Failed to delete account');

      setIsDeleteModalOpen(false);
      setIsDeleteSuccessModal(true);
      setCountdown(3); // reset countdown
    } catch (err) {
      console.error('Delete error:', err);
      notify.error(err.message || 'Something went wrong!');
    } finally {
      setLoading(false);
    }
  };

  // Countdown and redirect
  useEffect(() => {
    let timer;
    if (isDeleteSuccessModal) {
      timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            localStorage.clear();
            window.location.href = '/';
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [isDeleteSuccessModal]);

  return (
    <div className="security-wrapper">
      <section className="security-section">
        <h3>Change Your Password</h3>
        <p>Keep your account secure by updating your password regularly.</p>
        <button className="btn btn-secondary" onClick={() => setIsPasswordModalOpen(true)} disabled={loading}>
          Change Password
        </button>
      </section>
    {/* MFA Section */}
    <MFA />
      <section className="danger-zone">
        <h3>Danger Zone</h3>
        <p>
          Deleting your account is permanent and cannot be undone. Please proceed with caution.
        </p>
        <button className="btn btn-danger" onClick={() => setIsDeleteModalOpen(true)} disabled={loading}>
          Delete My Account
        </button>
      </section>

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
            </span>Change Password
          </div>
        </div>
      </Modal>

      {/* Delete Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title={isDeleteConfirmStep ? "Confirm Deletion" : "Are you absolutely sure?"}
        actions={
          isDeleteConfirmStep ? (
            <>
              <button className="btn btn-cancel" onClick={() => setIsDeleteModalOpen(false)} disabled={loading}>Cancel</button>
              <button className="btn btn-danger" onClick={handleFinalDelete} disabled={loading}>
                {loading ? 'Deleting...' : 'Delete Account'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-cancel" onClick={() => setIsDeleteModalOpen(false)} disabled={loading}>No</button>
              <button className="btn btn-danger" onClick={() => setIsDeleteConfirmStep(true)} disabled={loading}>Yes, Delete My Account</button>
            </>
          )
        }
      >
        {isDeleteConfirmStep ? (
          <>
            <p>To confirm, please enter your email and password.</p>
            <div className="form-group">
              <label>Email:</label>
              <input type="text" value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} />
            </div>
            <div className="form-group password-input">
              <label>Password:</label>
              <div className="password-wrapper">
                <input
                  type={showDeletePassword ? "text" : "password"}
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                />
                <span className="toggle-eye" onClick={() => setShowDeletePassword(prev => !prev)}>
                  {showDeletePassword ? <VisibilityOff /> : <Visibility />}
                </span>
              </div>
            </div>
          </>
        ) : (
          <p>
            This action will permanently remove your account and all associated data. 
            Are you absolutely sure you want to continue?
          </p>
        )}
      </Modal>

      {/* Delete Success Modal with Countdown */}
      <Modal
        isOpen={isDeleteSuccessModal}
        onClose={() => {}}
        title="Account Deleted"
        actions={null}
      >
        <p>Your account has been deleted. We're sorry to see you go.</p>
        <p>Redirecting you to the login page in {countdown} {countdown === 1 ? 'second' : 'seconds'}...</p>
      </Modal>
    </div>
  );
};

export default Security;
