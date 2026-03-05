import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@amon/shared";
import { getBackendErrorMessage, parseApiResponse } from "../../../Utils/apiError";
import {
  ACTIVITY_HISTORY_LIMIT,
  LOGIN_HISTORY_LIMIT,
  NOTIFICATION_HISTORY_LIMIT,
} from "../constants";
import { isSearchActivity } from "../utils";

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
