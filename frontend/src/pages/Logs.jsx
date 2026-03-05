import { useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./Styles/Logs.css";
import {
  ACTIVITY_HISTORY_LIMIT,
  LOGIN_HISTORY_LIMIT,
  NOTIFICATION_HISTORY_LIMIT,
} from "./logModules/constants";
import { LogsModuleCards } from "./logModules/components";
import { useLogsData } from "./logModules/hooks/useLogsData";

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

export default Logs;
