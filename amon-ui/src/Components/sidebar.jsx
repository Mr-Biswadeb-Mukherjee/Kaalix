// Sidebar.jsx

import React, { useState } from 'react';
// Importing React Router DOM hooks for navigation
import { Link, useLocation } from 'react-router-dom';
import DashboardIcon from '@mui/icons-material/Dashboard';
import TerminalIcon from '@mui/icons-material/Terminal';
import LayersIcon from '@mui/icons-material/Layers';
import StorageIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import InfoIcon from '@mui/icons-material/Info';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LanIcon from '@mui/icons-material/Lan';
import './Styles/sidebar.css';
import Logo from '../Components/Logo'


// ----------------------------------------------------------------------------------------------------
// Sidebar Component
// Renders a collapsible sidebar navigation for the application.
// Props:
// - collapsed: A boolean indicating whether the sidebar is collapsed.
// - setCollapsed: A function to toggle the collapsed state of the sidebar.
// ----------------------------------------------------------------------------------------------------


const Sidebar = ({ collapsed, setCollapsed }) => {
  const location = useLocation();
  const [active, setActive] = useState(location.pathname);
  const menuItems = [
    { name: 'Dashboard', icon: <DashboardIcon />, route: '/' },
    { name: 'Target Config', icon: <StorageIcon />, route: '/target-config' },
    { name: 'Attack Logic', icon: <TerminalIcon />, route: '/attack-logic' },
    { name: 'Modules', icon: <LayersIcon />, route: '/modules' },
    { name: 'Proxy', icon: <LanIcon />, route: '/proxy' },
    { name: 'About Us', icon: <InfoIcon />, route: '/about' },
    { name: 'Documentation', icon: <MenuBookIcon />, route: '/docs' },
  ];

  // Function to toggle the sidebar's collapsed state
  const toggleSidebar = () => {
    setCollapsed(prev => !prev);
  };
  return (
    <div className={`sidebar-container ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-logo-fixed">
        <Logo />
        {!collapsed && <span className="sidebar-logo-text">AMON</span>}
      </div>

      {/* Sidebar Toggle Button (Burger Icon) */}
      <div className="sidebar-toggle" onClick={toggleSidebar}>
        <div className={`burger ${collapsed ? '' : 'open'}`}>
          <span></span>
          <span></span>
          <span></span>
        </div>
      </div>

      {/* Main Navigation Menu */}
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
      {/* End of Main Navigation Menu */}
      
      {/* Bottom Section: Settings Link */}
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
  ); // End of Sidebar Container
};
export default Sidebar;
