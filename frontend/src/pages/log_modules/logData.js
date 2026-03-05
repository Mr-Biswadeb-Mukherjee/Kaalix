import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@amon/shared";
import { getBackendErrorMessage, parseApiResponse } from "../../Utils/apiError";

const SEARCH_ACTIVITY_KEYWORD = "intel.search_";

export const LOGIN_HISTORY_LIMIT = 10;
export const ACTIVITY_HISTORY_LIMIT = 40;
export const NOTIFICATION_HISTORY_LIMIT = 50;

const buildAuthHeaders = (token) => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
});

const sortNotificationsByTime = (entries = []) => {
  const normalized = Array.isArray(entries) ? entries.slice() : [];

  normalized.sort((a, b) => {
    const aTime = new Date(a?.createdAt || 0).getTime();
    const bTime = new Date(b?.createdAt || 0).getTime();
    return bTime - aTime;
  });

  return normalized;
};

export const formatDateTime = (value) => {
  if (!value) return "Unknown";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";

  return parsed.toLocaleString();
};

export const normalizeLineValue = (value, fallback = "unknown") => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
};

export const buildTerminalLine = (entry) => {
  const timestamp = formatDateTime(entry?.loggedInAt);
  const ipAddress = normalizeLineValue(entry?.ipAddress);
  const userAgent = normalizeLineValue(entry?.userAgent);

  return `[${timestamp}] LOGIN_SUCCESS ip=${ipAddress} ua="${userAgent}"`;
};

export const buildActivityDetails = (entry) => {
  const description = normalizeLineValue(entry?.description, "");
  const method = normalizeLineValue(entry?.metadata?.method, "");
  const query = normalizeLineValue(entry?.metadata?.query, "");

  if (description && method) return `${description} (method: ${method})`;
  if (description && query) return `${description} (query: ${query})`;
  if (description) return description;
  if (method && query) return `method: ${method} • query: ${query}`;
  if (method) return `method: ${method}`;
  if (query) return `query: ${query}`;

  return "No additional details.";
};

export const formatActivityTypeLabel = (value) => {
  const normalized = normalizeLineValue(value, "unknown");
  return normalized.replace(/\./g, " · ").replace(/_/g, " ");
};

export const resolveActivityBadgeClass = (value) => {
  const normalized = normalizeLineValue(value, "").toLowerCase();

  if (
    normalized.includes("login_success") ||
    normalized.includes("password_changed") ||
    normalized.includes("mfa_enabled") ||
    normalized.includes("intel.search_success")
  ) {
    return "success";
  }

  if (normalized.includes("mfa_disabled") || normalized.includes("intel.search_failed")) {
    return "warning";
  }

  return "neutral";
};

export const formatNotificationTypeLabel = (value) => {
  const normalized = normalizeLineValue(value, "system");
  return normalized.replace(/\./g, " · ").replace(/_/g, " ");
};

export const resolveNotificationSeverityClass = (value) => {
  const normalized = normalizeLineValue(value, "info").toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "warning") return "warning";
  if (normalized === "success") return "success";

  return "neutral";
};

const extractQuotedText = (value = "") => {
  if (typeof value !== "string") return "";

  const match = value.match(/"([^"]+)"/);
  return match?.[1]?.trim() || "";
};

export const isSearchActivity = (activityType) =>
  normalizeLineValue(activityType, "").toLowerCase().includes(SEARCH_ACTIVITY_KEYWORD);

export const extractActivityQuery = (entry) => {
  const metadataQuery = normalizeLineValue(entry?.metadata?.query, "");
  if (metadataQuery) return metadataQuery;

  const quotedDescription = extractQuotedText(entry?.description);
  if (quotedDescription) return quotedDescription;

  return extractQuotedText(entry?.title);
};

export const extractActivityMethod = (entry) => normalizeLineValue(entry?.metadata?.method, "");

export const useLogsData = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [requestError, setRequestError] = useState("");
  const [loginHistory, setLoginHistory] = useState([]);
  const [activityHistory, setActivityHistory] = useState([]);
  const [notificationHistory, setNotificationHistory] = useState([]);

  const token = localStorage.getItem("token");

  const fetchLogs = useCallback(async () => {
    if (!token) {
      setLoginHistory([]);
      setActivityHistory([]);
      setNotificationHistory([]);
      setRequestError("Missing session token. Please log in again.");
      return;
    }

    setIsLoading(true);
    try {
      const [loginRes, activityRes, notificationRes] = await Promise.all([
        fetch(`${API.system.protected.loginHistory.endpoint}?limit=${LOGIN_HISTORY_LIMIT}`, {
          method: "GET",
          headers: buildAuthHeaders(token),
        }),
        fetch(`${API.system.protected.activityLogs.endpoint}?limit=${ACTIVITY_HISTORY_LIMIT}`, {
          method: "GET",
          headers: buildAuthHeaders(token),
        }),
        fetch(`${API.system.protected.notifications.endpoint}?limit=${NOTIFICATION_HISTORY_LIMIT}`, {
          method: "GET",
          headers: buildAuthHeaders(token),
        }),
      ]);

      const [loginData, activityData, notificationData] = await Promise.all([
        parseApiResponse(loginRes),
        parseApiResponse(activityRes),
        parseApiResponse(notificationRes),
      ]);

      setLoginHistory(Array.isArray(loginData?.logins) ? loginData.logins : []);
      setActivityHistory(Array.isArray(activityData?.activities) ? activityData.activities : []);
      setNotificationHistory(sortNotificationsByTime(notificationData?.notifications));
      setRequestError("");
    } catch (err) {
      setRequestError(getBackendErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const accountHistory = useMemo(
    () => activityHistory.filter((entry) => !isSearchActivity(entry?.activityType)),
    [activityHistory]
  );

  const searchHistory = useMemo(
    () => activityHistory.filter((entry) => isSearchActivity(entry?.activityType)),
    [activityHistory]
  );

  return {
    isLoading,
    requestError,
    loginHistory,
    accountHistory,
    searchHistory,
    notificationHistory,
    fetchLogs,
  };
};
