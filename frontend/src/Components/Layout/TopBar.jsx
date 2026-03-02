import { useEffect, useRef, useState } from 'react';
import {
  AccessTime as AccessTimeIcon,
  TimerOutlined as TimerOutlinedIcon,
  LocationOn as LocationOnIcon,
  Brightness4 as Brightness4Icon,
  Forest as ForestIcon,
  WbSunny as WbSunnyIcon,
  NightsStay as NightsStayIcon,
  Bloodtype as BloodtypeIcon,
  AccountCircle as AccountCircleIcon,
  Logout as LogoutIcon,
  Person as PersonIcon,
  NotificationsNone as NotificationsNoneIcon,
  DoneAll as DoneAllIcon,
} from '@mui/icons-material';

import SafeImage from '../UI/safeImage';
import API from '@amon/shared';
import './Styles/TopBar.css';
import { useToast } from '../UI/Toast';
import { useAuth } from '../../Context/AuthContext';
import { useRealtime } from '../../Context/RealtimeContext';
import { getBrowserLocationLabel } from '../../Utils/browserLocation';
import { getBackendErrorMessage, parseApiResponse } from '../../Utils/apiError';

const formatRelativeTime = (rawValue) => {
  if (!rawValue) return '';

  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return '';

  const diffMs = Date.now() - date.getTime();
  if (Math.abs(diffMs) < 60000) return 'Just now';

  const diffMinutes = Math.floor(diffMs / 60000);
  if (Math.abs(diffMinutes) < 60) {
    return diffMinutes > 0 ? `${diffMinutes}m ago` : `in ${Math.abs(diffMinutes)}m`;
  }

  const diffHours = Math.floor(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return diffHours > 0 ? `${diffHours}h ago` : `in ${Math.abs(diffHours)}h`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return diffDays > 0 ? `${diffDays}d ago` : `in ${Math.abs(diffDays)}d`;
};

const decodeTokenExpiryMs = (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') return null;

  const tokenParts = rawToken.split('.');
  if (tokenParts.length !== 3) return null;

  try {
    const base64Url = tokenParts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payload = JSON.parse(window.atob(padded));
    const expSeconds = Number(payload?.exp);
    if (!Number.isFinite(expSeconds) || expSeconds <= 0) return null;
    return expSeconds * 1000;
  } catch {
    return null;
  }
};

const formatSessionTime = (remainingMs) => {
  if (!Number.isFinite(remainingMs)) return 'N/A';
  if (remainingMs <= 0) return 'Expired';

  const totalSeconds = Math.floor(remainingMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const mm = String(minutes).padStart(2, '0');
  const ss = String(seconds).padStart(2, '0');
  if (hours > 0) {
    return `${String(hours).padStart(2, '0')}:${mm}:${ss}`;
  }
  return `${mm}:${ss}`;
};

const TopBar = ({ collapsed }) => {
  const [time, setTime] = useState(new Date().toLocaleTimeString());
  const [location, setLocation] = useState('Fetching...');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'light');
  const [dropdownVisible, setDropdownVisible] = useState(false);
  const [user, setUser] = useState({ username: 'Loading...', avatar: null });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [sessionRemainingMs, setSessionRemainingMs] = useState(null);
  const [sessionExpiryLabel, setSessionExpiryLabel] = useState('');

  const notificationRef = useRef(null);
  const sessionExpiredHandledRef = useRef(false);

  const { addToast } = useToast();
  const { logout, onboardingRequired } = useAuth();
  const {
    notificationsLoading,
    notifications,
    unreadCount,
    markNotificationRead,
    markAllNotificationsRead,
    requestNotificationsRefresh,
  } = useRealtime();

  const token = localStorage.getItem('token');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!token) {
      setSessionRemainingMs(null);
      setSessionExpiryLabel('');
      sessionExpiredHandledRef.current = false;
      return;
    }

    sessionExpiredHandledRef.current = false;
    const expiryMs = decodeTokenExpiryMs(token);
    if (!expiryMs) {
      setSessionRemainingMs(null);
      setSessionExpiryLabel('');
      return;
    }

    setSessionExpiryLabel(new Date(expiryMs).toLocaleTimeString());

    const updateSessionRemaining = () => {
      const nextRemaining = Math.max(0, expiryMs - Date.now());
      setSessionRemainingMs(nextRemaining);
    };

    updateSessionRemaining();
    const intervalId = setInterval(updateSessionRemaining, 1000);

    return () => clearInterval(intervalId);
  }, [token]);

  useEffect(() => {
    if (!token || !Number.isFinite(sessionRemainingMs) || sessionRemainingMs > 0) {
      return;
    }
    if (sessionExpiredHandledRef.current) return;
    sessionExpiredHandledRef.current = true;

    const forceLogout = async () => {
      try {
        const result = await logout();
        if (!result?.success) {
          localStorage.removeItem('token');
        }
      } catch {
        localStorage.removeItem('token');
      } finally {
        addToast('Session expired. Please log in again.', 'warning');
        setTimeout(() => {
          window.location.href = '/';
        }, 1200);
      }
    };

    void forceLogout();
  }, [token, sessionRemainingMs, logout, addToast]);

  useEffect(() => {
    if (!token) return;

    fetch(API.system.protected.getprofile.endpoint, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
      .then((res) => parseApiResponse(res))
      .then((data) => {
        const avatarUrl = data.avatarUrl
          ? `${data.avatarUrl}?t=${Date.now()}`
          : null;

        setUser({
          username: data.fullName || 'Unknown User',
          avatar: avatarUrl,
        });
      })
      .catch((err) => {
        setUser({ username: 'Unknown User', avatar: null });
        addToast(getBackendErrorMessage(err), 'error');
      });
  }, [token, addToast]);

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

        const data = await parseApiResponse(res);
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

  useEffect(() => {
    if (!notificationsOpen) return;
    void requestNotificationsRefresh();
  }, [notificationsOpen, requestNotificationsRefresh]);

  useEffect(() => {
    if (!notificationsOpen) return;

    const handleOutsideClick = (event) => {
      if (!notificationRef.current) return;
      if (!notificationRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [notificationsOpen]);

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
      window.location.href = '/';
      return;
    }

    try {
      const result = await logout();
      if (result?.success) {
        addToast('Successfully logged out.', 'success');
        setTimeout(() => (window.location.href = '/'), 1500);
        return;
      }

      addToast(result?.message, result?.blocked ? 'warning' : 'error');
    } catch (err) {
      addToast(getBackendErrorMessage(err), 'error');
    }
  };

  const handleMarkAllRead = async () => {
    const ok = await markAllNotificationsRead();
    if (!ok) {
      addToast('Failed to mark all notifications as read.', 'error');
    }
  };

  const handleMarkOneRead = async (notificationId) => {
    const ok = await markNotificationRead(notificationId);
    if (!ok) {
      addToast('Failed to update notification state.', 'error');
    }
  };

  const isSessionCritical =
    Number.isFinite(sessionRemainingMs) &&
    sessionRemainingMs > 0 &&
    sessionRemainingMs <= 60000;

  return (
    <div className={`topbar-container ${collapsed ? 'collapsed' : ''}`}>
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

      <div className="topbar-status">
        <AccessTimeIcon className="topbar-icon" />
        <span className="topbar-text">{time}</span>
      </div>

      <div
        className={`topbar-status session-status ${isSessionCritical ? 'critical' : ''}`}
        title={sessionExpiryLabel ? `Token expires at ${sessionExpiryLabel}` : 'Token expiry unavailable'}
      >
        <TimerOutlinedIcon className="topbar-icon" />
        <span className="topbar-text">Session: {formatSessionTime(sessionRemainingMs)}</span>
      </div>

      <div className="topbar-status">
        <LocationOnIcon className="topbar-icon" />
        <span className="topbar-text">{location}</span>
      </div>

      <div className="topbar-status notification-dropdown" ref={notificationRef}>
        <button
          type="button"
          className="notification-trigger"
          onClick={() => setNotificationsOpen((prev) => !prev)}
          aria-label="Toggle notifications"
        >
          <NotificationsNoneIcon className="topbar-icon" />
          <span className="topbar-text">Notifications</span>
          {unreadCount > 0 && (
            <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
          )}
        </button>

        {notificationsOpen && (
          <div className="notification-dropdown-menu">
            <div className="notification-header">
              <strong>Notifications</strong>
              <button
                type="button"
                className="notification-mark-all"
                disabled={unreadCount === 0}
                onClick={handleMarkAllRead}
              >
                <DoneAllIcon fontSize="small" />
                Mark all read
              </button>
            </div>

            <div className="notification-list">
              {notificationsLoading ? (
                <div className="notification-empty">Loading...</div>
              ) : notifications.length === 0 ? (
                <div className="notification-empty">No notifications yet.</div>
              ) : (
                notifications.map((item) => (
                  <button
                    type="button"
                    key={item.notificationId}
                    className={`notification-item ${item.isRead ? 'read' : 'unread'}`}
                    onClick={() => {
                      if (!item.isRead) {
                        void handleMarkOneRead(item.notificationId);
                      }
                    }}
                  >
                    <div className="notification-item-top">
                      <span className="notification-title">{item.title}</span>
                      <span className="notification-time">{formatRelativeTime(item.createdAt)}</span>
                    </div>
                    <span className="notification-message">{item.message}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

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
            fallback={<div className="avatar-placeholder" />}
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
