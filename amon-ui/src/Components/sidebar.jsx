import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TerminalIcon from '@mui/icons-material/Terminal';
import LayersIcon from '@mui/icons-material/Layers';
import StorageIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import './Styles/sidebar.css';
import logo from '../assets/Amon.png';

const Sidebar = ({ collapsed, setCollapsed }) => {
  const location = useLocation();
  const [active, setActive] = useState(location.pathname);

  const menuItems = [
    { name: 'Dashboard', icon: <DashboardIcon />, route: '/' },
    { name: 'Target Config', icon: <StorageIcon />, route: '/target-config' },
    { name: 'Attack Logic', icon: <TerminalIcon />, route: '/attack-logic' },
    { name: 'Modules', icon: <LayersIcon />, route: '/modules' },
    { name: 'About Us', icon: <InfoIcon />, route: '/about' },
    { name: 'Documentation', icon: <MenuBookIcon />, route: '/docs' },
  ];

  const toggleSidebar = () => {
    setCollapsed(prev => !prev);
  };

  return (
    <div className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo-fixed">
        <img src={logo} alt="Logo" />
        {!collapsed && <span className="sidebar-logo-text">AMON</span>}
      </div>

      <div className="sidebar-toggle" onClick={toggleSidebar}>
        <div className={`burger ${collapsed ? '' : 'open'}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      <nav className="sidebar-menu">
        {menuItems.map((item) => (
          <Link
            to={item.route}
            key={item.name}
            className={`sidebar-item ${location.pathname === item.route ? 'active' : ''}`}
            data-tooltip={collapsed ? item.name : ''}
            onClick={() => setActive(item.route)}
          >
            <span className="sidebar-icon">{item.icon}</span>
            {!collapsed && <span className="sidebar-label">{item.name}</span>}
          </Link>
        ))}
      </nav>

      {/* Settings at bottom */}
      <div className="sidebar-bottom">
        <Link
          to="/settings"
          className={`sidebar-item ${location.pathname === '/settings' ? 'active' : ''}`}
          data-tooltip={collapsed ? 'Settings' : ''}
          onClick={() => setActive('/settings')}
        >
          <span className="sidebar-icon"><SettingsIcon /></span>
          {!collapsed && <span className="sidebar-label">Settings</span>}
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
