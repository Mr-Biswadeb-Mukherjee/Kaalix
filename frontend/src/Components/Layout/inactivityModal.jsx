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
          <h4>Your session has been idle for a while.</h4>
          <h4>
            <AccessTimeIcon fontSize="small" style={{ verticalAlign: 'middle', marginRight: '4px' }} />
            You will be automatically signed out in <span className="countdown">{countdown}</span> seconds.
          </h4>
          <h4 className="stay-hint">Move your mouse or press any key to remain logged in.</h4>
        </div>
        <div className="blood-drip" />
      </div>
    </div>
  );
};

export default InactivityModal;
