import {
  LogsModulePageShell,
  SearchHistoryModule,
} from "./logModules/components";
import { useLogsData } from "./logModules/hooks/useLogsData";

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

export default LogsSearchHistory;
