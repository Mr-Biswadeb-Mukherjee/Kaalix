import { Link } from "react-router-dom";
import { DashboardModulePageShell } from "./dashboardModules/components";

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
        Until then, continue using the live investigation workspace from
        {" "}
        <Link to="/dashboard/web-social-media-intelligence">Web & Social Media Intelligence</Link>
        .
      </p>
    </article>
  </DashboardModulePageShell>
);

export default DashboardDarkWebIntelligence;
