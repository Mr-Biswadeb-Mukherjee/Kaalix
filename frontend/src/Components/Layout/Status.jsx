import { useEffect, useState } from 'react';
import './Styles/statusBar.css';

import DnsIcon from '@mui/icons-material/Dns'; // OS
import MemoryIcon from '@mui/icons-material/Memory'; // RAM
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard'; // CPU
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'; // Swap
import GraphicEqIcon from '@mui/icons-material/GraphicEq'; // GPU
import PublicIcon from '@mui/icons-material/Public'; // IP
import LockIcon from '@mui/icons-material/Lock'
import API from '@amon/shared';

const StatusBar = ({ collapsed }) => {
  const [stats, setStats] = useState({});
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('No auth token');
        return;
      }

      try {
        const response = await fetch(API.system.protected.status.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({}),
        });

        if (response.status === 401 || response.status === 403) {
          // optional: clear token + redirect to login
          localStorage.removeItem('token');
          setError('Unauthorized');
          return;
        }

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();
        setStats(data.stats);   // ✅ FIX: only use the "stats" field
        setError(null);
      } catch (err) {
        console.error('Failed to fetch system stats:', err);
        setError('Unable to fetch stats');
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000); // refresh every 2s

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`status-bar ${collapsed ? 'collapsed' : ''}`}>
      <div className="status-item">
        <DnsIcon style={{ fontSize: 18, marginRight: 6 }} />
        OS: {error ? 'Error' : stats.os}
      </div>

      <div className="status-item">
        <DeveloperBoardIcon style={{ fontSize: 18, marginRight: 6 }} />
        CPU: {error ? 'Error' : stats.cpu}
      </div>

      <div className="status-item">
        <MemoryIcon style={{ fontSize: 18, marginRight: 6 }} />
        RAM: {error ? 'Error' : stats.ram}
      </div>

      <div className="status-item">
        <SwapHorizIcon style={{ fontSize: 18, marginRight: 6 }} />
        Swap: {error ? 'Error' : stats.swap}
      </div>

      <div className="status-item">
        <GraphicEqIcon style={{ fontSize: 18, marginRight: 6 }} />
        GPU: {error ? 'Error' : stats.gpu}
      </div>

      <div className="status-item">
        <PublicIcon style={{ fontSize: 18, marginRight: 6 }} />
        IP: {error ? 'Error' : stats.publicIP}
      </div>
      <div className="status-item">
        <LockIcon style={{ fontSize: 18, marginRight: 6 }} />
        Private IP: {error ? 'Error' : stats.privateIP}
      </div>
    </div>
  );
};

export default StatusBar;
