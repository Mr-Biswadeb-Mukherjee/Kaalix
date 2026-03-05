import { Link } from "react-router-dom";
import "../../Styles/Dashboard.css";

const DashboardModulePageShell = ({ title, subtitle, children, stateLabel = "Preview", stateClass = "planned" }) => (
  <section className="dashboard-shell dashboard-page">
    <header className="dashboard-shell-header dashboard-header">
      <div className="dashboard-header-copy">
        <Link className="dashboard-back-link" to="/dashboard">
          Back to Command Center
        </Link>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      <span className={`dashboard-module-state ${stateClass}`}>{stateLabel}</span>
    </header>

    <section className="dashboard-module-panel">{children}</section>
  </section>
);

export default DashboardModulePageShell;
