import { useState } from "react";
import {
  LoginHistoryModule,
  LogsModulePageShell,
} from "./logModules/components";
import { useLogsData } from "./logModules/hooks/useLogsData";

const LogsLoginSessions = () => {
  const [viewMode, setViewMode] = useState("table");
  const { isLoading, requestError, loginHistory, fetchLogs } = useLogsData();

  const actions = (
    <div className="view-mode-toggle">
      <button className={viewMode === "table" ? "active" : ""} onClick={() => setViewMode("table")}>
        Table
      </button>
      <button className={viewMode === "terminal" ? "active" : ""} onClick={() => setViewMode("terminal")}>
        Terminal
      </button>
    </div>
  );

  return (
    <LogsModulePageShell
      title="Login Sessions"
      subtitle="Audit recent successful login sessions with timestamp, IP address, and device user-agent."
      isLoading={isLoading}
      onRefresh={fetchLogs}
      actions={actions}
    >
      {requestError && <p className="logs-error">{requestError}</p>}
      {!requestError && (
        <LoginHistoryModule
          id="login-sessions"
          entries={loginHistory}
          isLoading={isLoading}
          viewMode={viewMode}
        />
      )}
    </LogsModulePageShell>
  );
};

export default LogsLoginSessions;
