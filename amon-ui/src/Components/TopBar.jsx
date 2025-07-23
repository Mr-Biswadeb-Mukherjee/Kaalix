import React, { useEffect, useState } from 'react';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import LocationOnIcon from '@mui/icons-material/LocationOn';
import Brightness4Icon from '@mui/icons-material/Brightness4';
import ForestIcon from '@mui/icons-material/Forest'; // Optional: for forest mode
import WbSunnyIcon from '@mui/icons-material/WbSunny'; // Optional: for light mode
import NightsStayIcon from '@mui/icons-material/NightsStay'; // Optional: for dark mode
import './Styles/TopBar.css';

const TopBar = ({ collapsed }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [location, setLocation] = useState('Fetching...');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

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

  const toggleTheme = () => {
    setTheme((prev) => {
      if (prev === 'light') return 'dark';
      if (prev === 'dark') return 'forest';
      return 'light';
    });
  };

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

  return (
    <div className={`topbar-container ${collapsed ? 'collapsed' : ''}`}>
      <div className="topbar-status theme-toggle" onClick={toggleTheme} title="Toggle Theme">
        {getThemeIcon()}
        <span className="topbar-text">
          {theme.charAt(0).toUpperCase() + theme.slice(1)} Mode
        </span>
      </div>
      <div className="topbar-status">
        <AccessTimeIcon className="topbar-icon" />
        <span className="topbar-text">{time}</span>
      </div>
      <div className="topbar-status">
        <LocationOnIcon className="topbar-icon" />
        <span className="topbar-text">{location}</span>
      </div>
    </div>
  );
};

export default TopBar;
