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
  const [user, setUser] = useState({ username: 'Loading...', avatar: null });

  const { addToast } = useToast();
  const token = localStorage.getItem('token');

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch user profile
  useEffect(() => {
    if (!token) return;

    fetch(API.system.protected.getprofile.endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch profile');
        return res.json();
      })
      .then((data) => {
        const avatarUrl = data.avatarUrl
          ? `${data.avatarUrl}?t=${Date.now()}` // ✅ add timestamp cache buster
          : null;

        setUser({
          username: data.fullName || 'Unknown User',
          avatar: avatarUrl,
        });
      })
      .catch(() => {
        setUser({ username: 'Unknown User', avatar: null });
        addToast('Failed to load profile info', 'error');
      });
  }, [token]);


  // Fetch location
  useEffect(() => {
    if (!token) return;

    fetch(API.system.protected.status.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error('Failed to fetch location');
        return res.json();
      })
      .then((data) => {
        setLocation(data?.stats?.location || 'Unknown Location');
      })
      .catch(() => setLocation('Unknown Location'));
  }, [token]);

  // Apply theme
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
    if (!token) {
      addToast('You are already logged out.', 'warning');
      window.location.href = '/';
      return;
    }

    try {
      const response = await fetch(API.system.public.logout.endpoint, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        addToast('Successfully logged out.', 'success');
        localStorage.removeItem('token');
        setTimeout(() => (window.location.href = '/'), 1500);
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
          <span className="topbar-text">{theme.charAt(0).toUpperCase() + theme.slice(1)} Mode</span>
        </div>
        <div className="theme-options">
          {themes.map((t) => (
            <div
              key={t.name}
              className={`theme-option ${t.name === theme ? 'active' : ''}`}
              onClick={() => setTheme(t.name)}
            >
              {t.icon}
              <span className="topbar-text">{t.name.charAt(0).toUpperCase() + t.name.slice(1)}</span>
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
        {user.avatar ? (
          <img src={user.avatar} alt="Avatar" className="topbar-avatar" />
        ) : (
          <AccountCircleIcon className="topbar-icon" />
        )}
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
