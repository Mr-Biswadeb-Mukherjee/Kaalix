import { Link } from "react-router-dom";
import "../Styles/Dashboard.css";

const DashboardModulePageShell = ({ title, subtitle, children, stateLabel, stateClass }) => (
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

const DashboardDarkWebIntelligence = () => (
  <DashboardModulePageShell
    title="Dark Web Intelligence"
    subtitle="Operational space for hidden-service monitoring, threat actor chatter, and underground footprint analysis."
    stateLabel="Preview"
    stateClass="preview"
  >
    <article className="dashboard-module-content-card">
      <h3>Module Preview</h3>
      <p>
        This module is staged for the next release. It will add monitored channels, alert rules, and evidence linking
        to the KaaliX entity graph.
      </p>
      <p>
        Until then, continue using the live investigation workspace from {" "}
        <Link to="/dashboard/web-social-media-intelligence">Web &amp; Social Media Intelligence</Link>.
      </p>
    </article>
  </DashboardModulePageShell>
);

const DashboardBreachExposureIntelligence = () => (
  <DashboardModulePageShell
    title="Breach & Exposure Intelligence"
    subtitle="Central workspace for leak correlation, credential exposure tracking, and risk trend visibility."
    stateLabel="Planned"
    stateClass="planned"
  >
    <article className="dashboard-module-content-card">
      <h3>Planned Capability</h3>
      <p>
        The breach lane will aggregate exposed account evidence and map it to organizations, domains, and user
        identities from ongoing intelligence operations.
      </p>
      <ul className="dashboard-module-list">
        <li>Credential and data leak ingestion</li>
        <li>Exposure scoring and prioritization</li>
        <li>Linked-entity and timeline context</li>
      </ul>
    </article>
  </DashboardModulePageShell>
);

const DashboardInfrastructureIntelligence = () => (
  <DashboardModulePageShell
    title="Infrastructure Intelligence"
    subtitle="Map infrastructure relationships across domain, DNS, certificate, and hosting telemetry."
    stateLabel="Planned"
    stateClass="planned"
  >
    <article className="dashboard-module-content-card">
      <h3>Planned Capability</h3>
      <p>
        This module will focus on infrastructure-level pivots to uncover connected assets and suspicious service
        overlap.
      </p>
      <ul className="dashboard-module-list">
        <li>Domain and subdomain expansion</li>
        <li>Certificate and registrar intelligence</li>
        <li>IP and hosting provider correlation</li>
      </ul>
    </article>
  </DashboardModulePageShell>
);

export {
  DashboardDarkWebIntelligence,
  DashboardBreachExposureIntelligence,
  DashboardInfrastructureIntelligence,
};
