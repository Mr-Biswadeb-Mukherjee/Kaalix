import { useMemo } from "react";
import { buildTerminalLine, formatDateTime, normalizeLineValue } from "../utils";

const LoginHistoryModule = ({ id, entries, isLoading, viewMode }) => {
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

export default LoginHistoryModule;
