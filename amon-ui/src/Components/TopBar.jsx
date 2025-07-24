// Topbar.jsx

import React, { useEffect, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import ForestIcon from '@mui/icons-material/Forest'; 
import WbSunnyIcon from '@mui/icons-material/WbSunny'; 
import NightsStayIcon from '@mui/icons-material/NightsStay'; 
import './Styles/TopBar.css';

// ----------------------------------------------------------------------------------------------------
// TopBar Component
// Renders a top bar displaying current time, user's location, and a theme toggle.
// Props:
// - collapsed: A boolean indicating whether the sidebar is collapsed, affecting top bar's layout.
// ----------------------------------------------------------------------------------------------------

const TopBar = ({ collapsed }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [location, setLocation] = useState('Fetching...');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  // ----------------------------------------------------------------------------------------------------
  // useEffect Hook for Time and Location Updates
  // Sets up an interval for time updates and fetches user's location on component mount.
  // Cleans up the interval on component unmount.
  // ----------------------------------------------------------------------------------------------------
  useEffect(() => {
    // Set up interval to update time every second
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

    // Cleanup function to clear the interval
    return () => clearInterval(timer);
  }, []);

  // ----------------------------------------------------------------------------------------------------
  // Theme Toggling Logic
  // Cycles through 'light', 'dark', and 'forest' themes.
  // ----------------------------------------------------------------------------------------------------
  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'forest';
      return 'light';
    });
  };

  // ----------------------------------------------------------------------------------------------------
  // Helper function to get the appropriate theme icon based on the current theme.
  // ----------------------------------------------------------------------------------------------------
  const getThemeIcon = () => {
    switch (theme) {
      case 'light':
        return <WbSunnyIcon className="topbar-icon" />;
      case 'dark':
        return <NightsStayIcon className="topbar-icon" />;
      case 'forest':
        return <ForestIcon className="topbar-icon" />;
      default:
        return <Brightness4Icon className="topbar-icon" />;
    }
  };

  // ----------------------------------------------------------------------------------------------------
  // Render Method
  // ----------------------------------------------------------------------------------------------------
  return (
    // Main container for the top bar, applies 'collapsed' class based on prop
    <div className={`topbar-container ${collapsed ? 'collapsed' : ''}`}>
      {/* Theme Toggle Section */}
      <div className="topbar-status theme-toggle" onClick={toggleTheme} title="Toggle Theme">
        {getThemeIcon()}
        <span className="topbar-text">
          {theme.charAt(0).toUpperCase() + theme.slice(1)} Mode
        </span>
      </div>
      {/* Current Time Display */}
      <div className="topbar-status">
        <AccessTimeIcon className="topbar-icon" />
        <span className="topbar-text">{time}</span>
      </div>
      {/* User Location Display */}
      <div className="topbar-status">
        <LocationOnIcon className="topbar-icon" />
        <span className="topbar-text">{location}</span>
      </div>
    </div>
  );
};

// ----------------------------------------------------------------------------------------------------
// Export the TopBar Component
// ----------------------------------------------------------------------------------------------------
export default TopBar;
