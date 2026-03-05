import {
  formatDateTime,
  formatNotificationTypeLabel,
  normalizeLineValue,
  resolveNotificationSeverityClass,
} from "../utils";

const NotificationHistoryModule = ({ id, entries, isLoading }) => (
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

export default NotificationHistoryModule;
