import {
  buildActivityDetails,
  extractActivityMethod,
  extractActivityQuery,
  formatDateTime,
  normalizeLineValue,
  resolveActivityBadgeClass,
} from "../utils";

const resolveSearchResultLabel = (activityType) => {
  const normalized = normalizeLineValue(activityType, "").toLowerCase();
  if (normalized.includes("failed")) return "failed";
  if (normalized.includes("success")) return "success";
  return "unknown";
};

const SearchHistoryModule = ({ id, entries, isLoading }) => (
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

export default SearchHistoryModule;
