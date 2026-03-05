import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./Styles/Logs.css";
import {
  ACTIVITY_HISTORY_LIMIT,
  LOGIN_HISTORY_LIMIT,
  NOTIFICATION_HISTORY_LIMIT,
  useLogsData,
} from "./log_modules/logData";
import { LogsModuleCards, LogsModulePageShell } from "./log_modules/LogsLayoutAndCards";
import {
  AccountHistoryModule,
  LoginHistoryModule,
  NotificationHistoryModule,
  SearchHistoryModule,
} from "./log_modules/LogsHistoryModules";

const Logs = () => {
  const navigate = useNavigate();
  const {
    isLoading,
    requestError,
    loginHistory,
    accountHistory,
    searchHistory,
    notificationHistory,
    fetchLogs,
  } = useLogsData();

  const moduleCards = useMemo(
    () => [
      {
        id: "account",
        route: "/logs/account-history",
        icon: "person-vcard-fill",
        title: "Account History",
        count: accountHistory.length,
        meta: `Showing up to ${ACTIVITY_HISTORY_LIMIT} events`,
        description: "Password, MFA, login/logout, and profile-level security activity.",
      },
      {
        id: "search",
        route: "/logs/search-history",
        icon: "search",
        title: "Search History",
        count: searchHistory.length,
        meta: `Showing up to ${ACTIVITY_HISTORY_LIMIT} search events`,
        description: "Recent intel query trail with success/failure context and method.",
      },
      {
        id: "login",
        route: "/logs/login-sessions",
        icon: "box-arrow-in-right",
        title: "Login Sessions",
        count: loginHistory.length,
        meta: `Showing up to ${LOGIN_HISTORY_LIMIT} sessions`,
        description: "Recent successful sign-ins with timestamp, IP, and user-agent.",
      },
      {
        id: "notifications",
        route: "/logs/notifications",
        icon: "bell",
        title: "Notifications",
        count: notificationHistory.length,
        meta: `Showing up to ${NOTIFICATION_HISTORY_LIMIT} events`,
        description: "Unified security timeline with severity and read-state tracking.",
      },
    ],
    [accountHistory.length, searchHistory.length, loginHistory.length, notificationHistory.length]
  );

  const openModule = useCallback(
    (card) => {
      if (!card?.route) return;
      navigate(card.route);
    },
    [navigate]
  );

  return (
    <div className="page-container logs-page">
      <div className="logs-hero">
        <div className="logs-title-wrap">
          <h1>Account Logs</h1>
          <p className="logs-subtitle">
            Select a log module to open its dedicated page.
          </p>
        </div>
        <div className="logs-actions logs-actions-end">
          <button className="logs-refresh-btn" onClick={fetchLogs} disabled={isLoading}>
            {isLoading ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>
      <LogsModuleCards cards={moduleCards} onOpenModule={openModule} />
      {requestError && <p className="logs-error">{requestError}</p>}
    </div>
  );
};

const LogsAccountHistory = () => {
  const { isLoading, requestError, accountHistory, fetchLogs } = useLogsData();

  return (
    <LogsModulePageShell
      title="Account History"
      subtitle="Review account-level security events like login/logout, MFA, and password actions."
      isLoading={isLoading}
      onRefresh={fetchLogs}
    >
      {requestError && <p className="logs-error">{requestError}</p>}
      {!requestError && (
        <AccountHistoryModule id="account-history" entries={accountHistory} isLoading={isLoading} />
      )}
    </LogsModulePageShell>
  );
};

const LogsSearchHistory = () => {
  const { isLoading, requestError, searchHistory, fetchLogs } = useLogsData();

  return (
    <LogsModulePageShell
      title="Search History"
      subtitle="Inspect intelligence search queries and their success or failure outcomes."
      isLoading={isLoading}
      onRefresh={fetchLogs}
    >
      {requestError && <p className="logs-error">{requestError}</p>}
      {!requestError && (
        <SearchHistoryModule id="search-history" entries={searchHistory} isLoading={isLoading} />
      )}
    </LogsModulePageShell>
  );
};

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

const LogsNotifications = () => {
  const { isLoading, requestError, notificationHistory, fetchLogs } = useLogsData();

  return (
    <LogsModulePageShell
      title="Notification Timeline"
      subtitle="Track the full notification feed with severity and read-state context."
      isLoading={isLoading}
      onRefresh={fetchLogs}
    >
      {requestError && <p className="logs-error">{requestError}</p>}
      {!requestError && (
        <NotificationHistoryModule
          id="notification-history"
          entries={notificationHistory}
          isLoading={isLoading}
        />
      )}
    </LogsModulePageShell>
  );
};

export { Logs, LogsAccountHistory, LogsSearchHistory, LogsLoginSessions, LogsNotifications };

export default Logs;
