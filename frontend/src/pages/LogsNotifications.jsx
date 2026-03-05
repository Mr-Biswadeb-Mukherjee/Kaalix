import {
  LogsModulePageShell,
  NotificationHistoryModule,
} from "./logModules/components";
import { useLogsData } from "./logModules/hooks/useLogsData";

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

export default LogsNotifications;
