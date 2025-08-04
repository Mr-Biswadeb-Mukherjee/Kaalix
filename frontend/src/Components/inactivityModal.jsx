import React from 'react';
import './Styles/inactivityModal.css';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import AccessTimeIcon from '@mui/icons-material/AccessTime';

const InactivityModal = ({ open, countdown }) => {
  if (!open) return null;

  return (
    <div className="vampire-modal-overlay">
      <div className="vampire-modal">
        <div className="vampire-header">
          <WarningAmberIcon style={{ verticalAlign: 'middle', marginRight: '8px' }} />
          Session Timeout Warning
        </div>
        <div className="vampire-body">
          <p>Your session has been idle for a while.</p>
          <p>
            <AccessTimeIcon fontSize="small" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            You will be automatically signed out in <span className="countdown">{countdown}</span> seconds.
          </p>
          <p className="stay-hint">Move your mouse or press any key to remain logged in.</p>
        </div>
        <div className="blood-drip" />
      </div>
    </div>
  );
};

export default InactivityModal;
