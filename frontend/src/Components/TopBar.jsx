import React, { useEffect, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import ForestIcon from '@mui/icons-material/Forest';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import LogoutIcon from '@mui/icons-material/Logout';
import NightsStayIcon from '@mui/icons-material/NightsStay';
import BloodtypeIcon from '@mui/icons-material/Bloodtype';
import './Styles/TopBar.css';

// ----------------------------------------------------------------------------------------------------
// TopBar Component
// Renders a top bar displaying current time, user's location, and a theme dropdown selector.
// ----------------------------------------------------------------------------------------------------

const TopBar = ({ collapsed }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [location, setLocation] = useState('Fetching...');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  // Set current theme on mount and update on change
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // Update time every second and fetch location on component mount
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

  // Define themes and corresponding icons
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

  // ----------------------------------------------------------------------------------------------------
  // Render Method
  // ----------------------------------------------------------------------------------------------------

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

      {/* Current Time */}
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
        onClick={() => {
          localStorage.removeItem('token');
          window.location.href = '/';
        }}
        title="Logout"
      >
        <LogoutIcon className="topbar-icon" />
        <span className="topbar-text">Logout</span>
      </div>
    </div>
  );
};

export default TopBar;
