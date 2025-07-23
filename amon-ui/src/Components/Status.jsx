import React, { useEffect, useState } from 'react';
import './Styles/statusBar.css';

// Import icons from MUI
import MemoryIcon from '@mui/icons-material/Memory';
import StorageIcon from '@mui/icons-material/Storage';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';

const StatusBar = ({ collapsed }) => {
  const [stats, setStats] = useState({
    cpu: '0%',
    ram: '0%',
    gpu: '0%',
  });

  useEffect(() => {
    const interval = setInterval(() => {
      setStats({
        cpu: `${(Math.random() * 100).toFixed(1)}%`,
        ram: `${(Math.random() * 100).toFixed(1)}%`,
        gpu: `${(Math.random() * 100).toFixed(1)}%`,
      });
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className={`status-bar ${collapsed ? 'collapsed' : ''}`}>
      <div className="status-item">
        <MemoryIcon style={{ fontSize: 18, marginRight: 6 }} />
        CPU: {stats.cpu}
      </div>
      <div className="status-item">
        <StorageIcon style={{ fontSize: 18, marginRight: 6 }} />
        RAM: {stats.ram}
      </div>
      <div className="status-item">
        <DeveloperBoardIcon style={{ fontSize: 18, marginRight: 6 }} />
        GPU: {stats.gpu}
      </div>
    </div>
  );
};

export default StatusBar;
