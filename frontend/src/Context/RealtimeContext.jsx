/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import API from "@amon/shared";
import { parseApiResponse } from "../Utils/apiError";
import { useAuth } from "./AuthContext";

const RealtimeContext = createContext({
  connected: false,
  stats: null,
  monitoring: null,
  notifications: [],
  intelligenceNotifications: [],
  regularNotifications: [],
  unreadCount: 0,
  unreadCounts: { all: 0, intelligence: 0, regular: 0 },
  notificationsLoading: false,
  markNotificationRead: async () => {},
  markAllNotificationsRead: async () => {},
  requestNotificationsRefresh: async () => {},
});

const INTELLIGENCE_SEVERITIES = new Set(["warning", "critical"]);

const getToken = () => {
  const token = localStorage.getItem("token");
  return typeof token === "string" ? token.trim() : "";
};

const normalizeNotificationList = (value) => (Array.isArray(value) ? value : []);

const isIntelligenceNotification = (notification) => {
  const severity =
    typeof notification?.severity === "string"
      ? notification.severity.trim().toLowerCase()
      : "";
  return INTELLIGENCE_SEVERITIES.has(severity);
};

const normalizeUnreadValue = (value, fallback = 0) => {
  const normalized = Number(value);
  if (Number.isFinite(normalized) && normalized >= 0) {
    return normalized;
  }

  const fallbackValue = Number(fallback);
  if (Number.isFinite(fallbackValue) && fallbackValue >= 0) {
    return fallbackValue;
  }

  return 0;
};

const resolveNotificationState = (payload) => {
  const notifications = normalizeNotificationList(payload?.notifications);
  const hasExplicitBuckets =
    Array.isArray(payload?.intelligenceNotifications) ||
    Array.isArray(payload?.regularNotifications);

  const intelligenceNotifications = hasExplicitBuckets
    ? normalizeNotificationList(payload?.intelligenceNotifications)
    : notifications.filter(isIntelligenceNotification);
  const regularNotifications = hasExplicitBuckets
    ? normalizeNotificationList(payload?.regularNotifications)
    : notifications.filter((item) => !isIntelligenceNotification(item));

  const fallbackUnreadIntelligence = intelligenceNotifications.filter((item) => !item?.isRead).length;
  const fallbackUnreadRegular = regularNotifications.filter((item) => !item?.isRead).length;
  const fallbackUnreadAll = notifications.filter((item) => !item?.isRead).length;
  const rawUnreadCounts =
    payload?.unreadCounts && typeof payload.unreadCounts === "object"
      ? payload.unreadCounts
      : {};
  const unreadCount = normalizeUnreadValue(
    payload?.unreadCount,
    normalizeUnreadValue(rawUnreadCounts.all, fallbackUnreadAll)
  );

  return {
    notifications,
    intelligenceNotifications,
    regularNotifications,
    unreadCount,
    unreadCounts: {
      all: normalizeUnreadValue(rawUnreadCounts.all, unreadCount),
      intelligence: normalizeUnreadValue(rawUnreadCounts.intelligence, fallbackUnreadIntelligence),
      regular: normalizeUnreadValue(rawUnreadCounts.regular, fallbackUnreadRegular),
    },
  };
};

const clampReconnectDelay = (attempt) => {
  const raw = 500 * 2 ** Math.max(0, attempt - 1);
  return Math.min(raw, 10000);
};

const buildRealtimeWsUrl = (token) => {
  const isSecure = window.location.protocol === "https:";
  const protocol = isSecure ? "wss:" : "ws:";

  let host = window.location.host;

  if (import.meta.env.DEV) {
    const hostname = window.location.hostname || "127.0.0.1";
    const backendPort = import.meta.env.VITE_BACKEND_PORT || "4000";
    host = `${hostname}:${backendPort}`;
  } else if (!host) {
    host = "127.0.0.1:4000";
  }

  return `${protocol}//${host}${API.system.protected.realtime.endpoint}?token=${encodeURIComponent(token)}`;
};

export const RealtimeProvider = ({ children }) => {
  const { isAuthenticated, loading: authLoading } = useAuth();

  const [connected, setConnected] = useState(false);
  const [stats, setStats] = useState(null);
  const [monitoring, setMonitoring] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [intelligenceNotifications, setIntelligenceNotifications] = useState([]);
  const [regularNotifications, setRegularNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [unreadCounts, setUnreadCounts] = useState({
    all: 0,
    intelligence: 0,
    regular: 0,
  });
  const [notificationsLoading, setNotificationsLoading] = useState(false);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectAttemptRef = useRef(0);
  const shouldReconnectRef = useRef(false);

  const clearReconnectTimer = useCallback(() => {
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
    }
  }, []);

  const closeSocket = useCallback(() => {
    const socket = wsRef.current;
    wsRef.current = null;

    if (socket) {
      try {
        socket.close();
      } catch {
        // ignore close errors
      }
    }
  }, []);

  const applyNotificationPayload = useCallback((payload) => {
    const next = resolveNotificationState(payload);
    setNotifications(next.notifications);
    setIntelligenceNotifications(next.intelligenceNotifications);
    setRegularNotifications(next.regularNotifications);
    setUnreadCount(next.unreadCount);
    setUnreadCounts(next.unreadCounts);
  }, []);

  const fetchStatusFallback = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setStats(null);
      return;
    }

    try {
      const response = await fetch(API.system.protected.status.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseApiResponse(response);
      if (data?.stats && typeof data.stats === "object") {
        setStats(data.stats);
      }
    } catch {
      // fallback is best-effort only
    }
  }, []);

  const fetchNotificationsFallback = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setNotifications([]);
      setIntelligenceNotifications([]);
      setRegularNotifications([]);
      setUnreadCount(0);
      setUnreadCounts({ all: 0, intelligence: 0, regular: 0 });
      return;
    }

    setNotificationsLoading(true);

    try {
      const response = await fetch(`${API.system.protected.notifications.endpoint}?limit=15`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseApiResponse(response, { requireSuccess: true });
      applyNotificationPayload(data);
    } catch {
      // fallback is best-effort only
    } finally {
      setNotificationsLoading(false);
    }
  }, [applyNotificationPayload]);

  const fetchMonitoringFallback = useCallback(async () => {
    const token = getToken();
    if (!token) {
      setMonitoring(null);
      return;
    }

    try {
      const response = await fetch(API.system.protected.monitoring.endpoint, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      const data = await parseApiResponse(response, { requireSuccess: true });
      setMonitoring(data?.monitoring && typeof data.monitoring === "object" ? data.monitoring : null);
    } catch {
      // fallback is best-effort only
    }
  }, []);

  const connectSocket = useCallback(() => {
    const token = getToken();
    if (!token || !shouldReconnectRef.current) {
      return;
    }

    closeSocket();
    clearReconnectTimer();

    let socket;

    try {
      socket = new WebSocket(buildRealtimeWsUrl(token));
    } catch {
      return;
    }

    wsRef.current = socket;

    socket.onopen = () => {
      setConnected(true);
      reconnectAttemptRef.current = 0;
      socket.send(JSON.stringify({ type: "notifications.refresh" }));
    };

    socket.onmessage = (event) => {
      let payload;

      try {
        payload = JSON.parse(String(event.data || ""));
      } catch {
        return;
      }

      if (!payload || typeof payload !== "object") return;

      switch (payload.type) {
        case "realtime.connected": {
          if (payload.stats && typeof payload.stats === "object") {
            setStats(payload.stats);
          }
          if (payload.monitoring && typeof payload.monitoring === "object") {
            setMonitoring(payload.monitoring);
          }
          applyNotificationPayload(payload);
          setNotificationsLoading(false);
          break;
        }
        case "system.stats": {
          if (payload.stats && typeof payload.stats === "object") {
            setStats(payload.stats);
          }
          if (payload.monitoring && typeof payload.monitoring === "object") {
            setMonitoring(payload.monitoring);
          }
          break;
        }
        case "notifications.snapshot": {
          applyNotificationPayload(payload);
          setNotificationsLoading(false);
          break;
        }
        default:
          break;
      }
    };

    socket.onerror = () => {
      // onclose will handle reconnect.
    };

    socket.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      if (!shouldReconnectRef.current) {
        return;
      }

      reconnectAttemptRef.current += 1;
      const delay = clampReconnectDelay(reconnectAttemptRef.current);

      clearReconnectTimer();
      reconnectTimerRef.current = setTimeout(() => {
        connectSocket();
      }, delay);
    };
  }, [applyNotificationPayload, clearReconnectTimer, closeSocket]);

  const requestNotificationsRefresh = useCallback(async () => {
    const socket = wsRef.current;
    if (socket && socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify({ type: "notifications.refresh" }));
      return;
    }

    await fetchNotificationsFallback();
  }, [fetchNotificationsFallback]);

  const markNotificationRead = useCallback(async (notificationId) => {
    const normalizedId = typeof notificationId === "string" ? notificationId.trim() : "";
    if (!normalizedId) return false;

    const token = getToken();
    if (!token) return false;

    try {
      const response = await fetch(API.system.protected.notificationsMarkRead.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ notificationId: normalizedId }),
      });

      const data = await parseApiResponse(response, { requireSuccess: true });

      setNotifications((prev) =>
        prev.map((item) =>
          item.notificationId === normalizedId ? { ...item, isRead: true } : item
        )
      );
      setIntelligenceNotifications((prev) =>
        prev.map((item) =>
          item.notificationId === normalizedId ? { ...item, isRead: true } : item
        )
      );
      setRegularNotifications((prev) =>
        prev.map((item) =>
          item.notificationId === normalizedId ? { ...item, isRead: true } : item
        )
      );
      setUnreadCount(normalizeUnreadValue(data?.unreadCount, 0));
      setUnreadCounts((prev) => ({
        all: normalizeUnreadValue(data?.unreadCounts?.all, normalizeUnreadValue(data?.unreadCount, prev.all)),
        intelligence: normalizeUnreadValue(data?.unreadCounts?.intelligence, prev.intelligence),
        regular: normalizeUnreadValue(data?.unreadCounts?.regular, prev.regular),
      }));
      return true;
    } catch {
      return false;
    }
  }, []);

  const markAllNotificationsRead = useCallback(async () => {
    const token = getToken();
    if (!token) return false;

    try {
      const response = await fetch(API.system.protected.notificationsMarkAllRead.endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      });

      await parseApiResponse(response, { requireSuccess: true });
      setNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setIntelligenceNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setRegularNotifications((prev) => prev.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
      setUnreadCounts({ all: 0, intelligence: 0, regular: 0 });
      return true;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    if (authLoading) return () => {};

    const token = getToken();
    const canConnect = isAuthenticated && Boolean(token);

    if (!canConnect) {
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      closeSocket();
      setConnected(false);
      setStats(null);
      setMonitoring(null);
      setNotifications([]);
      setIntelligenceNotifications([]);
      setRegularNotifications([]);
      setUnreadCount(0);
      setUnreadCounts({ all: 0, intelligence: 0, regular: 0 });
      setNotificationsLoading(false);
      return () => {};
    }

    shouldReconnectRef.current = true;
    setNotificationsLoading(true);

    void fetchStatusFallback();
    void fetchMonitoringFallback();
    void fetchNotificationsFallback();
    connectSocket();

    return () => {
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      closeSocket();
      setConnected(false);
    };
  }, [
    authLoading,
    clearReconnectTimer,
    closeSocket,
    connectSocket,
    fetchNotificationsFallback,
    fetchMonitoringFallback,
    fetchStatusFallback,
    isAuthenticated,
  ]);

  useEffect(() => {
    if (!isAuthenticated || connected) return () => {};

    const intervalId = setInterval(() => {
      void fetchStatusFallback();
      void fetchMonitoringFallback();
      void fetchNotificationsFallback();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [
    connected,
    fetchMonitoringFallback,
    fetchNotificationsFallback,
    fetchStatusFallback,
    isAuthenticated,
  ]);

  const value = useMemo(
    () => ({
      connected,
      stats,
      monitoring,
      notifications,
      intelligenceNotifications,
      regularNotifications,
      unreadCount,
      unreadCounts,
      notificationsLoading,
      markNotificationRead,
      markAllNotificationsRead,
      requestNotificationsRefresh,
    }),
    [
      connected,
      stats,
      monitoring,
      notifications,
      intelligenceNotifications,
      regularNotifications,
      unreadCount,
      unreadCounts,
      notificationsLoading,
      markNotificationRead,
      markAllNotificationsRead,
      requestNotificationsRefresh,
    ]
  );

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
};

export const useRealtime = () => useContext(RealtimeContext);
