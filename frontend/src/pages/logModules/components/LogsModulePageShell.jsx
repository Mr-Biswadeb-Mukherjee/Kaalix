import { Link } from "react-router-dom";

const LogsModulePageShell = ({ title, subtitle, isLoading, onRefresh, children, actions = null }) => (
  <div className="page-container logs-page">
    <div className="logs-hero">
      <div className="logs-title-wrap">
        <Link className="logs-back-link" to="/logs">
          Back to Logs
        </Link>
        <h1>{title}</h1>
        <p className="logs-subtitle">{subtitle}</p>
      </div>
      <div className="logs-actions logs-actions-end">
        {actions}
        <button className="logs-refresh-btn" onClick={onRefresh} disabled={isLoading}>
          {isLoading ? "Refreshing..." : "Refresh"}
        </button>
      </div>
    </div>

    {children}
  </div>
);

export default LogsModulePageShell;
