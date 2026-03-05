import { DashboardModulePageShell } from "./dashboardModules/components";

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

export default DashboardBreachExposureIntelligence;
