import React, { useEffect, useState } from 'react';
import './Styles/statusBar.css';

import DnsIcon from '@mui/icons-material/Dns'; // OS
import MemoryIcon from '@mui/icons-material/Memory'; // RAM
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard'; // CPU
import SwapHorizIcon from '@mui/icons-material/SwapHoriz'; // Swap
import GraphicEqIcon from '@mui/icons-material/GraphicEq'; // GPU
import PublicIcon from '@mui/icons-material/Public'; // IP


const StatusBar = ({ collapsed }) => {
  const [stats, setStats] = useState({
    os: 'Unknown',
    cpu: '0%',
    ram: '0%',
    gpu: '0%',
    ip: '0.0.0.0',
    swap: '0%'
  });

  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch('/api/v3/system/stats', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({}) // send an empty payload or include future filters
        });

        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

        const data = await response.json();

        setStats({
          os: data.os || 'Unknown',
          cpu: data.cpu || 'N/A',
          ram: data.ram || 'N/A',
          gpu: data.gpu || 'N/A',
          ip: data.ip || 'N/A',
          swap: data.swap || 'N/A'
        });

        setError(null);
      } catch (err) {
        console.error('Failed to fetch system stats:', err);
        setError('Unable to fetch stats');
      }
    };

    fetchStats();
    const interval = setInterval(fetchStats, 2000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`status-bar ${collapsed ? 'collapsed' : ''}`}>
      {/* OS */}
      <div className="status-item">
        <DnsIcon style={{ fontSize: 18, marginRight: 6 }} />
        OS: {error ? 'N/A' : stats.os}
      </div>

      <div className="status-item">
        <DeveloperBoardIcon style={{ fontSize: 18, marginRight: 6 }} />
        CPU: {error ? 'N/A' : stats.cpu}
      </div>

      <div className="status-item">
        <MemoryIcon style={{ fontSize: 18, marginRight: 6 }} />
        RAM: {error ? 'N/A' : stats.ram}
      </div>

      <div className="status-item">
        <SwapHorizIcon style={{ fontSize: 18, marginRight: 6 }} />
        Swap: {error ? 'N/A' : stats.swap}
      </div>

      <div className="status-item">
        <GraphicEqIcon style={{ fontSize: 18, marginRight: 6 }} />
        GPU: {error ? 'N/A' : stats.gpu}
      </div>

      <div className="status-item">
        <PublicIcon style={{ fontSize: 18, marginRight: 6 }} />
        IP: {error ? 'N/A' : stats.ip}
      </div>
    </div>
  );
};

export default StatusBar;
