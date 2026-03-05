import {
  buildActivityDetails,
  formatActivityTypeLabel,
  formatDateTime,
  normalizeLineValue,
  resolveActivityBadgeClass,
} from "../utils";

const AccountHistoryModule = ({ id, entries, isLoading }) => (
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

export default AccountHistoryModule;
