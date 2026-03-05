import { DashboardModulePageShell } from "./dashboardModules/components";

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

export default DashboardInfrastructureIntelligence;
