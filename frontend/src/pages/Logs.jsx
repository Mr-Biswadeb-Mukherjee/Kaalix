import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@amon/shared";
import "./Styles/Logs.css";
import { getBackendErrorMessage, parseApiResponse } from "../Utils/apiError";

const HISTORY_LIMIT = 10;
const ACTIVITY_LIMIT = 20;
const NOTIFICATION_LIMIT = 50;

const formatDateTime = (value) => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
};

const normalizeLineValue = (value, fallback = "unknown") => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
};

const buildTerminalLine = (entry) => {
  const timestamp = formatDateTime(entry?.loggedInAt);
  const ipAddress = normalizeLineValue(entry?.ipAddress);
  const userAgent = normalizeLineValue(entry?.userAgent);
  return `[${timestamp}] LOGIN_SUCCESS ip=${ipAddress} ua="${userAgent}"`;
};

const buildActivityDetails = (entry) => {
  const description = normalizeLineValue(entry?.description, "");
  const method = normalizeLineValue(entry?.metadata?.method, "");
  if (description && method) return `${description} (method: ${method})`;
  if (description) return description;
  if (method) return `method: ${method}`;
  return "No additional details.";
};

const formatActivityTypeLabel = (value) => {
  const normalized = normalizeLineValue(value, "unknown");
  return normalized.replace(/\./g, " · ").replace(/_/g, " ");
};

const resolveActivityBadgeClass = (value) => {
  const normalized = normalizeLineValue(value, "").toLowerCase();
  if (
    normalized.includes("login_success") ||
    normalized.includes("password_changed") ||
    normalized.includes("mfa_enabled")
  ) {
    return "success";
  }
  if (normalized.includes("mfa_disabled")) return "warning";
  return "neutral";
};

const formatNotificationTypeLabel = (value) => {
  const normalized = normalizeLineValue(value, "system");
  return normalized.replace(/\./g, " · ").replace(/_/g, " ");
};

const resolveNotificationSeverityClass = (value) => {
  const normalized = normalizeLineValue(value, "info").toLowerCase();
  if (normalized === "critical") return "critical";
  if (normalized === "warning") return "warning";
  if (normalized === "success") return "success";
  return "neutral";
};

const Logs = () => {
  const [viewMode, setViewMode] = useState("table");
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
        fetch(`${API.system.protected.loginHistory.endpoint}?limit=${HISTORY_LIMIT}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${API.system.protected.activityLogs.endpoint}?limit=${ACTIVITY_LIMIT}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }),
        fetch(`${API.system.protected.notifications.endpoint}?limit=${NOTIFICATION_LIMIT}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
        }),
      ]);

      const [loginData, activityData, notificationData] = await Promise.all([
        parseApiResponse(loginRes),
        parseApiResponse(activityRes),
        parseApiResponse(notificationRes),
      ]);

      setLoginHistory(Array.isArray(loginData?.logins) ? loginData.logins : []);
      setActivityHistory(Array.isArray(activityData?.activities) ? activityData.activities : []);
      const normalizedNotifications = Array.isArray(notificationData?.notifications)
        ? notificationData.notifications
        : [];
      normalizedNotifications.sort((a, b) => {
        const aTime = new Date(a?.createdAt || 0).getTime();
        const bTime = new Date(b?.createdAt || 0).getTime();
        return bTime - aTime;
      });
      setNotificationHistory(normalizedNotifications);
      setRequestError("");
    } catch (err) {
      setRequestError(getBackendErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const terminalLines = useMemo(
    () => loginHistory.map((entry) => buildTerminalLine(entry)),
    [loginHistory]
  );

  return (
    <div className="page-container logs-page">
      <div className="logs-hero">
        <div className="logs-title-wrap">
          <h1>Account Logs</h1>
          <p className="logs-subtitle">
            Track your latest successful logins, password changes, MFA updates, and other security
            activity, along with a unified notification timeline.
          </p>
        </div>
        <div className="logs-actions">
          <div className="view-mode-toggle">
            <button
              className={viewMode === "table" ? "active" : ""}
              onClick={() => setViewMode("table")}
            >
              Table
            </button>
            <button
              className={viewMode === "terminal" ? "active" : ""}
              onClick={() => setViewMode("terminal")}
            >
              Terminal
            </button>
          </div>
          <button className="logs-refresh-btn" onClick={fetchLogs} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      <div className="logs-summary-grid">
        <div className="logs-stat-card">
          <p className="logs-stat-label">Login Entries</p>
          <p className="logs-stat-value">{loginHistory.length}</p>
          <p className="logs-stat-meta">Showing up to {HISTORY_LIMIT} most recent</p>
        </div>
        <div className="logs-stat-card">
          <p className="logs-stat-label">Recent Activity</p>
          <p className="logs-stat-value">{activityHistory.length}</p>
          <p className="logs-stat-meta">Showing up to {ACTIVITY_LIMIT} events</p>
        </div>
        <div className="logs-stat-card">
          <p className="logs-stat-label">Notifications</p>
          <p className="logs-stat-value">{notificationHistory.length}</p>
          <p className="logs-stat-meta">Showing up to {NOTIFICATION_LIMIT} events</p>
        </div>
      </div>

      {requestError && <p className="logs-error">{requestError}</p>}

      {!requestError && (
        <section className="logs-panel">
          <div className="logs-panel-head">
            <h2>Last 10 Login Events</h2>
          </div>
          {!isLoading && loginHistory.length === 0 && (
            <p className="logs-empty">No login history available yet.</p>
          )}
          {loginHistory.length > 0 && (
            <div className="logs-table-wrap">
              {viewMode === "table" ? (
                <table className="logs-table">
                  <thead>
                    <tr>
                      <th>Timestamp</th>
                      <th>IP Address</th>
                      <th>User Agent</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loginHistory.map((entry, index) => (
                      <tr key={entry.loginId || `${entry.loggedInAt || "time"}-${index}`}>
                        <td>{formatDateTime(entry.loggedInAt)}</td>
                        <td>{normalizeLineValue(entry.ipAddress, "Unavailable")}</td>
                        <td>{normalizeLineValue(entry.userAgent, "Unavailable")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="logs-terminal">
                  <pre>{terminalLines.join("\n")}</pre>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {!requestError && (
        <section className="logs-panel">
          <div className="logs-panel-head">
            <h2>Recent Account Activity</h2>
          </div>
          {!isLoading && activityHistory.length === 0 && (
            <p className="logs-empty">No recent activity available yet.</p>
          )}
          {activityHistory.length > 0 && (
            <div className="logs-table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Event</th>
                    <th>Type</th>
                    <th>Details</th>
                    <th>IP Address</th>
                  </tr>
                </thead>
                <tbody>
                  {activityHistory.map((entry, index) => (
                    <tr key={entry.activityId || `${entry.occurredAt || "time"}-${index}`}>
                      <td>{formatDateTime(entry.occurredAt)}</td>
                      <td>{normalizeLineValue(entry.title, "Activity")}</td>
                      <td>
                        <span
                          className={`activity-badge ${resolveActivityBadgeClass(entry.activityType)}`}
                        >
                          {formatActivityTypeLabel(entry.activityType)}
                        </span>
                      </td>
                      <td className="logs-details-cell">{buildActivityDetails(entry)}</td>
                      <td>{normalizeLineValue(entry.ipAddress, "Unavailable")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {!requestError && (
        <section className="logs-panel">
          <div className="logs-panel-head">
            <h2>Unified Notification Timeline</h2>
          </div>
          {!isLoading && notificationHistory.length === 0 && (
            <p className="logs-empty">No notifications available yet.</p>
          )}
          {notificationHistory.length > 0 && (
            <div className="logs-table-wrap">
              <table className="logs-table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Severity</th>
                    <th>Event</th>
                    <th>Title</th>
                    <th>Message</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {notificationHistory.map((entry, index) => (
                    <tr key={entry.notificationId || `${entry.createdAt || "time"}-${index}`}>
                      <td>{formatDateTime(entry.createdAt)}</td>
                      <td>
                        <span
                          className={`activity-badge ${resolveNotificationSeverityClass(entry.severity)}`}
                        >
                          {normalizeLineValue(entry.severity, "info")}
                        </span>
                      </td>
                      <td>{formatNotificationTypeLabel(entry.type)}</td>
                      <td>{normalizeLineValue(entry.title, "Notification")}</td>
                      <td className="logs-details-cell">{normalizeLineValue(entry.message, "No message")}</td>
                      <td>
                        <span className={`read-state-pill ${entry.isRead ? "read" : "unread"}`}>
                          {entry.isRead ? "Read" : "Unread"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default Logs;
