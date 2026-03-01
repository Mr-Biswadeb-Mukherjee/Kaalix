import { useEffect, useState } from 'react';
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

import SafeImage from '../UI/safeImage';
import API from '@amon/shared';
import './Styles/TopBar.css';
import { useToast } from '../UI/Toast';
import { useAuth } from '../../Context/AuthContext';
import { getBrowserLocationLabel } from '../../Utils/browserLocation';

const TopBar = ({ collapsed }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [location, setLocation] = useState('Fetching...');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [user, setUser] = useState({ username: 'Loading...', avatar: null });

  const { addToast } = useToast();
  const { logout, onboardingRequired } = useAuth();
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
  }, [token, addToast]);


  // Fetch location
  useEffect(() => {
    if (!token) return;
    if (onboardingRequired) {
      setLocation('Complete Required Setup');
      return;
    }

    let isMounted = true;

    const resolveLocationText = (data) => {
      const locationText = typeof data?.stats?.location === 'string'
        ? data.stats.location.trim()
        : '';
      if (locationText && locationText !== 'N/A') {
        return locationText;
      }

      const lat = Number(data?.stats?.preciseLocation?.latitude);
      const lng = Number(data?.stats?.preciseLocation?.longitude);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
      }

      return 'Unknown Location';
    };

    const fetchLocationFromAPI = async () => {
      try {
        const res = await fetch(API.system.protected.status.endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        });

        if (!res.ok) throw new Error('Failed to fetch location');
        const data = await res.json();
        if (!isMounted) return;
        setLocation(resolveLocationText(data));
      } catch {
        if (!isMounted) return;
        setLocation('Unknown Location');
      }
    };

    const refreshLocation = async () => {
      const browserLocation = await getBrowserLocationLabel();
      if (browserLocation) {
        if (!isMounted) return;
        setLocation(browserLocation);
        return;
      }

      await fetchLocationFromAPI();
    };

    refreshLocation();
    const intervalId = setInterval(refreshLocation, 30000);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, [token, onboardingRequired]);

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

    if (onboardingRequired) {
      addToast('Complete profile update and password change before logout.', 'warning');
      return;
    }

    try {
      const result = await logout();
      if (result?.success) {
        addToast('Successfully logged out.', 'success');
        setTimeout(() => (window.location.href = '/'), 1500);
        return;
      }

      addToast(result?.message || 'Logout failed.', result?.blocked ? 'warning' : 'error');
    } catch {
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
          <SafeImage
            src={user.avatar}
            alt="Avatar"
            className="topbar-avatar"
            fallback={<div className="avatar-placeholder" />} // optional fallback UI
          />
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
            <div
              className="dropdown-item"
              onClick={handleLogout}
              style={onboardingRequired ? { opacity: 0.5, cursor: 'not-allowed' } : undefined}
            >
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
