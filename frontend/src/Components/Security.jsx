import React, { useState } from 'react';
import { useToast } from '../Components/Toast'; // ✅ Toast hook
import './Styles/Security.css';
import API from '@amon/shared'; // ✅ API Endpoints

const Security = ({ username }) => {
  const { addToast } = useToast();

  // Password Modal State
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Delete Modal State
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [isDeleteConfirmStep, setIsDeleteConfirmStep] = useState(false);
  const [deleteUsername, setDeleteUsername] = useState('');
  const [deletePassword, setDeletePassword] = useState('');

  // Loading state (optional)
  const [loading, setLoading] = useState(false);

  // ✅ Notifications
  const notify = {
    passwordChanged: () => addToast('Password has been changed successfully!', 'success'),
    passwordMismatch: () => addToast('New password and confirmation do not match!', 'error'),
    passwordTooShort: () => addToast('Password must be at least 6 characters long!', 'warning'),
    passwordMissing: () => addToast('Please enter your current password!', 'warning'),
    accountDeleted: () => addToast('Your account has been deleted permanently!', 'success'),
    invalidDelete: () => addToast('Invalid username or password!', 'error'),
    deleteFieldsRequired: () => addToast('All fields are required!', 'warning'),
    usernameMismatch: () => addToast('Username does not match your account!', 'error'),
    loggedOut: () => addToast('Logged out successfully!', 'info'),
    apiError: (msg) => addToast(msg || 'Something went wrong!', 'error'),
  };

  // Password Modal Handlers
  const openPasswordModal = () => setIsPasswordModalOpen(true);
  const closePasswordModal = () => {
    setIsPasswordModalOpen(false);
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const handlePasswordChange = async () => {
    if (!oldPassword) {
      notify.passwordMissing();
      return;
    }
    if (newPassword !== confirmPassword) {
      notify.passwordMismatch();
      return;
    }
    if (newPassword.length < 6) {
      notify.passwordTooShort();
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const res = await fetch(API.system.protected.changepass.endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ username, oldPassword, newPassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to change password');

      notify.passwordChanged();
      closePasswordModal();
    } catch (err) {
      notify.apiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete Modal Handlers
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

  const handleDeleteYes = () => setIsDeleteConfirmStep(true);
  const handleDeleteNo = () => closeDeleteModal();

  const handleFinalDelete = async () => {
    if (!deleteUsername || !deletePassword) {
      notify.deleteFieldsRequired();
      return;
    }
    if (deleteUsername !== username) {
      notify.usernameMismatch();
      return;
    }
    if (deletePassword.length < 6) {
      notify.passwordTooShort();
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/v3/delete-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        'Authorization': `Bearer ${token}`,
        credentials: 'include',
        body: JSON.stringify({ username, password: deletePassword }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to delete account');

      notify.accountDeleted();
      closeDeleteModal();

      // Redirect to landing page after delete
      window.location.href = '/goodbye';
    } catch (err) {
      notify.apiError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Logout Handler
  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      addToast('You are already logged out.', 'warning');
      window.location.href = '/';
      return;
    }

    try {
      const response = await fetch(API.system.public.logout.endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        addToast('Successfully logged out.', 'success');
        localStorage.removeItem('token');

        setTimeout(() => {
          window.location.href = '/';
        }, 1500);
      } else {
        const err = await response.json();
        addToast(`Logout failed: ${err.message || 'Unknown error'}`, 'error');
      }
    } catch (err) {
      console.error('🚨 Logout error:', err);
      addToast('Network error during logout. Please try again.', 'error');
    }
  };

  return (
    <div className="security-wrapper">
      {/* Change Password Section */}
      <section className="security-section">
        <h3 className="security-heading">Change Password</h3>
        <p className="security-description">
          Update your password to keep your account secure.
        </p>
        <button className="btn btn-secondary" onClick={openPasswordModal} disabled={loading}>
          Change Password
        </button>
      </section>

      {/* Danger Zone Section */}
      <section className="danger-zone">
        <h3 className="danger-zone-heading">Danger Zone</h3>
        <p className="danger-zone-description">
          These actions are permanent and cannot be undone. Proceed with caution.
        </p>
        <div className="danger-zone-actions">
          <button className="btn btn-danger" onClick={openDeleteModal} disabled={loading}>
            Delete Account
          </button>
          <button className="btn btn-logout" onClick={handleLogout} disabled={loading}>
            Logout
          </button>
        </div>
      </section>

      {/* Password Modal */}
      {isPasswordModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            <h2 className="modal-title">Change Password</h2>

            <div className="form-group">
              <label className="form-label">Old Password:</label>
              <input
                type="password"
                className="form-input"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Password:</label>
              <input
                type="password"
                className="form-input"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Confirm New Password:</label>
              <input
                type="password"
                className="form-input"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>

            <div className="modal-actions">
              <button className="btn btn-cancel" onClick={closePasswordModal} disabled={loading}>
                Cancel
              </button>
              <button className="btn btn-save" onClick={handlePasswordChange} disabled={loading}>
                {loading ? 'Applying...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteModalOpen && (
        <div className="modal-overlay">
          <div className="modal-container">
            {!isDeleteConfirmStep ? (
              <>
                <h2 className="modal-title">Are you sure you want to delete your account?</h2>
                <p className="modal-warning">This action is irreversible.</p>
                <div className="modal-actions">
                  <button className="btn btn-cancel" onClick={handleDeleteNo} disabled={loading}>
                    No
                  </button>
                  <button className="btn btn-danger" onClick={handleDeleteYes} disabled={loading}>
                    Yes
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="modal-title">Confirm Deletion</h2>
                <p className="modal-warning">
                  Please enter your username and password to confirm.
                </p>

                <div className="form-group">
                  <label className="form-label">Username:</label>
                  <input
                    type="text"
                    className="form-input"
                    value={deleteUsername}
                    onChange={(e) => setDeleteUsername(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Password:</label>
                  <input
                    type="password"
                    className="form-input"
                    value={deletePassword}
                    onChange={(e) => setDeletePassword(e.target.value)}
                  />
                </div>

                <div className="modal-actions">
                  <button className="btn btn-cancel" onClick={closeDeleteModal} disabled={loading}>
                    Cancel
                  </button>
                  <button className="btn btn-danger" onClick={handleFinalDelete} disabled={loading}>
                    {loading ? 'Deleting...' : 'Delete Account'}
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

export default Security;
