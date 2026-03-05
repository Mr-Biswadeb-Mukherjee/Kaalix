import { useMemo } from "react";
import {
  buildActivityDetails,
  buildTerminalLine,
  extractActivityMethod,
  extractActivityQuery,
  formatActivityTypeLabel,
  formatDateTime,
  formatNotificationTypeLabel,
  normalizeLineValue,
  resolveActivityBadgeClass,
  resolveNotificationSeverityClass,
} from "./logData";

const resolveSearchResultLabel = (activityType) => {
  const normalized = normalizeLineValue(activityType, "").toLowerCase();
  if (normalized.includes("failed")) return "failed";
  if (normalized.includes("success")) return "success";
  return "unknown";
};

export const AccountHistoryModule = ({ id, entries, isLoading }) => (
  <section id={id} className="logs-panel logs-module-section">
    <div className="logs-panel-head">
      <h2>Account History</h2>
    </div>
    {!isLoading && entries.length === 0 && <p className="logs-empty">No account activity available yet.</p>}
    {entries.length > 0 && (
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
            {entries.map((entry, index) => (
              <tr key={entry.activityId || `${entry.occurredAt || "time"}-${index}`}>
                <td>{formatDateTime(entry.occurredAt)}</td>
                <td>{normalizeLineValue(entry.title, "Activity")}</td>
                <td>
                  <span className={`activity-badge ${resolveActivityBadgeClass(entry.activityType)}`}>
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
);

export const SearchHistoryModule = ({ id, entries, isLoading }) => (
  <section id={id} className="logs-panel logs-module-section">
    <div className="logs-panel-head">
      <h2>Search History</h2>
    </div>
    {!isLoading && entries.length === 0 && <p className="logs-empty">No search history available yet.</p>}
    {entries.length > 0 && (
      <div className="logs-table-wrap">
        <table className="logs-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Query</th>
              <th>Result</th>
              <th>Method</th>
              <th>Details</th>
              <th>IP Address</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((entry, index) => (
              <tr key={entry.activityId || `${entry.occurredAt || "time"}-${index}`}>
                <td>{formatDateTime(entry.occurredAt)}</td>
                <td>{normalizeLineValue(extractActivityQuery(entry), "Not captured")}</td>
                <td>
                  <span className={`activity-badge ${resolveActivityBadgeClass(entry.activityType)}`}>
                    {resolveSearchResultLabel(entry.activityType)}
                  </span>
                </td>
                <td>{normalizeLineValue(extractActivityMethod(entry), "Unavailable")}</td>
                <td className="logs-details-cell">{buildActivityDetails(entry)}</td>
                <td>{normalizeLineValue(entry.ipAddress, "Unavailable")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </section>
);

export const LoginHistoryModule = ({ id, entries, isLoading, viewMode }) => {
  const terminalLines = useMemo(() => entries.map((entry) => buildTerminalLine(entry)), [entries]);

  return (
    <section id={id} className="logs-panel logs-module-section">
      <div className="logs-panel-head">
        <h2>Login Sessions</h2>
      </div>
      {!isLoading && entries.length === 0 && <p className="logs-empty">No login history available yet.</p>}
      {entries.length > 0 && (
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
                {entries.map((entry, index) => (
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
  );
};

export const NotificationHistoryModule = ({ id, entries, isLoading }) => (
  <section id={id} className="logs-panel logs-module-section">
    <div className="logs-panel-head">
      <h2>Unified Notification Timeline</h2>
    </div>
    {!isLoading && entries.length === 0 && <p className="logs-empty">No notifications available yet.</p>}
    {entries.length > 0 && (
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
            {entries.map((entry, index) => (
              <tr key={entry.notificationId || `${entry.createdAt || "time"}-${index}`}>
                <td>{formatDateTime(entry.createdAt)}</td>
                <td>
                  <span className={`activity-badge ${resolveNotificationSeverityClass(entry.severity)}`}>
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
);
