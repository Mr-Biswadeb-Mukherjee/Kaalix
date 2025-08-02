import React, { useEffect, useState } from 'react';
import {
  AccessTime as AccessTimeIcon,
  LocationOn as LocationOnIcon,
  Brightness4 as Brightness4Icon,
  Forest as ForestIcon,
  WbSunny as WbSunnyIcon,
  Logout as LogoutIcon,
  NightsStay as NightsStayIcon,
  Bloodtype as BloodtypeIcon
} from '@mui/icons-material';

import FAPI from '../FAPIs/FAPIs';
import './Styles/TopBar.css';
import { useToast } from './Toast'; // ✅ Custom toast hook

const TopBar = ({ collapsed }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [location, setLocation] = useState('Fetching...');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const { addToast } = useToast(); // ✅ use toast context

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
      const response = await fetch(FAPI.system.Logout.endpoint, {
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

      {/* Logout */}
      <div
        className="topbar-status logout-button"
        onClick={handleLogout}
        title="Logout"
      >
        <LogoutIcon className="topbar-icon" />
        <span className="topbar-text">Logout</span>
      </div>
    </div>
  );
};

export default TopBar;
