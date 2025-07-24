// Statusbar.jsx

import React, { useEffect, useState } from 'react';
import './Styles/statusBar.css';
import MemoryIcon from '@mui/icons-material/Memory';
import StorageIcon from '@mui/icons-material/Storage';
import DeveloperBoardIcon from '@mui/icons-material/DeveloperBoard';

// ----------------------------------------------------------------------------------------------------
// StatusBar Component
// Renders a status bar displaying real-time (simulated) CPU, RAM, and GPU usage.
// Props:
// - collapsed: A boolean indicating whether the sidebar (and thus the status bar) is collapsed.
// ----------------------------------------------------------------------------------------------------

const StatusBar = ({ collapsed }) => {
  // State to hold the CPU, RAM, and GPU usage statistics
  const [stats, setStats] = useState({
    cpu: '0%',
    ram: '0%',
    gpu: '0%',
  });

  useEffect(() => {
    // Set up an interval to update the stats every 2 seconds
    const interval = setInterval(() => {
      // Simulate random usage percentages for demonstration
      setStats({
        cpu: `${(Math.random() * 100).toFixed(1)}%`,
        ram: `${(Math.random() * 100).toFixed(1)}%`,
        gpu: `${(Math.random() * 100).toFixed(1)}%`,
      });
    }, 2000);

    // Clean up the interval when the component unmounts or the effect re-runs
    return () => clearInterval(interval);
  }, []);

  return (
    // Main container for the status bar, applies 'collapsed' class based on prop
    <div className={`status-bar ${collapsed ? 'collapsed' : ''}`}>
      {/* CPU Status Item */}
      <div className="status-item">
        <MemoryIcon style={{ fontSize: 18, marginRight: 6 }} />
        CPU: {stats.cpu}
      </div>
      {/* RAM Status Item */}
      <div className="status-item">
        <StorageIcon style={{ fontSize: 18, marginRight: 6 }} />
        RAM: {stats.ram}
      </div>
      {/* GPU Status Item */}
      <div className="status-item">
        <DeveloperBoardIcon style={{ fontSize: 18, marginRight: 6 }} />
        GPU: {stats.gpu}
      </div>
    </div>
  );
};
// Exporting the StatusBar component as default
export default StatusBar;
