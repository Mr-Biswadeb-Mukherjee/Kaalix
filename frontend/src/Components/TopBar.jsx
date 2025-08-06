import React, { useEffect, useState } from 'react';
import {
  AccessTime as AccessTimeIcon,
  LocationOn as LocationOnIcon,
  Brightness4 as Brightness4Icon,
  Forest as ForestIcon,
  WbSunny as WbSunnyIcon,
  NightsStay as NightsStayIcon,
  Bloodtype as BloodtypeIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Person as PersonIcon
} from '@mui/icons-material';

import API from '@amon/shared';
import './Styles/TopBar.css';
import { useToast } from './Toast';

const TopBar = ({ collapsed }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [location, setLocation] = useState('Fetching...');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [dropdownVisible, setDropdownVisible] = useState(false);

  const { addToast } = useToast();

  // Mock user data (replace with context/store in real app)
  const [user] = useState({
    username: 'Biswadeb',
    avatar: null, // Add avatar URL here if available
  });

  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date().toLocaleTimeString());
    }, 1000);

    fetch('https://ipapi.co/json/')
      .then((res) => res.json())
      .then((data) => {
        setLocation(`${data.city}, ${data.region}, ${data.country_name}`);
      })
      .catch(() => {
        setLocation('Unknown Location');
      });

    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const themes = [
    { name: 'light', icon: <WbSunnyIcon className="topbar-icon" /> },
    { name: 'dark', icon: <NightsStayIcon className="topbar-icon" /> },
    { name: 'forest', icon: <ForestIcon className="topbar-icon" /> },
    { name: 'vampire', icon: <BloodtypeIcon className="topbar-icon" /> },
  ];

  const getThemeIcon = (name = theme) => {
    const themeObj = themes.find((t) => t.name === name);
    return themeObj ? themeObj.icon : <Brightness4Icon className="topbar-icon" />;
  };

  const handleLogout = async () => {
    const token = localStorage.getItem('token');
    if (!token) {
      addToast('You are already logged out.', 'warning');
      window.location.href = '/';
      return;
    }

    try {
      const response = await fetch(API.system.auth.logout.endpoint, {
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
    <div className={`topbar-container ${collapsed ? 'collapsed' : ''}`}>
      {/* Theme Dropdown */}
      <div className="topbar-status theme-dropdown">
        <div className="theme-selected">
          {getThemeIcon()}
          <span className="topbar-text">
            {theme.charAt(0).toUpperCase() + theme.slice(1)} Mode
          </span>
        </div>
        <div className="theme-options">
          {themes.map((t) => (
            <div
              key={t.name}
              className={`theme-option ${t.name === theme ? 'active' : ''}`}
              onClick={() => setTheme(t.name)}
            >
              {t.icon}
              <span className="topbar-text">
                {t.name.charAt(0).toUpperCase() + t.name.slice(1)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Time */}
      <div className="topbar-status">
        <AccessTimeIcon className="topbar-icon" />
        <span className="topbar-text">{time}</span>
      </div>

      {/* Location */}
      <div className="topbar-status">
        <LocationOnIcon className="topbar-icon" />
        <span className="topbar-text">{location}</span>
      </div>

      {/* User Profile Dropdown */}
      <div
        className="topbar-status profile-dropdown"
        onMouseEnter={() => setDropdownVisible(true)}
        onMouseLeave={() => setDropdownVisible(false)}
      >
        <AccountCircleIcon className="topbar-icon" />
        <span className="topbar-text">{user.username}</span>

        {dropdownVisible && (
          <div className="profile-dropdown-menu">
            <div
              className="dropdown-item"
              onClick={() => (window.location.href = '/profile')}
            >
              <PersonIcon className="dropdown-icon" />
              <span>Account Settings</span>
            </div>
            <div className="dropdown-item" onClick={handleLogout}>
              <LogoutIcon className="dropdown-icon" />
              <span>Logout</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TopBar;
