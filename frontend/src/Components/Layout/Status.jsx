import './Styles/statusBar.css';

import DnsIcon from '@mui/icons-material/Dns';
import MemoryIcon from '@mui/icons-material/Memory';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import GraphicEqIcon from '@mui/icons-material/GraphicEq';
import PublicIcon from '@mui/icons-material/Public';
import LockIcon from '@mui/icons-material/Lock';
import { useRealtime } from '../../Context/RealtimeContext';

const StatusBar = ({ collapsed }) => {
  const { stats } = useRealtime();

  const resolvedStats = stats || {};

  return (
    <div className={`status-bar ${collapsed ? 'collapsed' : ''}`}>
      <div className="status-item">
        <DnsIcon style={{ fontSize: 18, marginRight: 6 }} />
        OS: {resolvedStats.os || 'N/A'}
      </div>

      <div className="status-item">
        <DeveloperBoardIcon style={{ fontSize: 18, marginRight: 6 }} />
        CPU: {resolvedStats.cpu || 'N/A'}
      </div>

      <div className="status-item">
        <MemoryIcon style={{ fontSize: 18, marginRight: 6 }} />
        RAM: {resolvedStats.ram || 'N/A'}
      </div>

      <div className="status-item">
        <SwapHorizIcon style={{ fontSize: 18, marginRight: 6 }} />
        Swap: {resolvedStats.swap || 'N/A'}
      </div>

      <div className="status-item">
        <GraphicEqIcon style={{ fontSize: 18, marginRight: 6 }} />
        GPU: {resolvedStats.gpu || 'N/A'}
      </div>

      <div className="status-item">
        <PublicIcon style={{ fontSize: 18, marginRight: 6 }} />
        IP: {resolvedStats.publicIP || 'N/A'}
      </div>

      <div className="status-item">
        <LockIcon style={{ fontSize: 18, marginRight: 6 }} />
        Private IP: {resolvedStats.privateIP || 'N/A'}
      </div>
    </div>
  );
};

export default StatusBar;
