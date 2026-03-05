import {
  AccountHistoryModule,
  LogsModulePageShell,
} from "./logModules/components";
import { useLogsData } from "./logModules/hooks/useLogsData";

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

export default LogsAccountHistory;
