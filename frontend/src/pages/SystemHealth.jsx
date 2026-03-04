import SystemHealthWidget from "../Components/UI/SystemHealthWidget";
import { useRealtime } from "../Context/RealtimeContext";
import { asPercent, toNumber } from "../Utils/systemHealth";
import "./Styles/SystemHealth.css";

const formatUpdatedAt = (rawValue) => {
  if (!rawValue) return "Waiting for feed";
  const date = new Date(rawValue);
  if (Number.isNaN(date.getTime())) return "Waiting for feed";
  return date.toLocaleString();
};

const SystemHealth = () => {
  const { connected, monitoring, stats } = useRealtime();
  const resolvedMonitoring = monitoring || {};
  const resolvedStats = stats || {};

  const topFailingEndpoints = Array.isArray(resolvedMonitoring.topFailingEndpoints)
    ? resolvedMonitoring.topFailingEndpoints
    : [];
  const topBusyEndpoints = Array.isArray(resolvedMonitoring.topBusyEndpoints)
    ? resolvedMonitoring.topBusyEndpoints
    : [];

  return (
    <section className="system-health-page">
      <header className="system-health-page-header">
        <h1>System Health Details</h1>
        <p>
          Detailed realtime view of service stability, traffic quality, and host telemetry.
        </p>
      </header>

      <div className="system-health-page-lead">
        <SystemHealthWidget />
      </div>

      <div className="system-health-page-grid">
        <article className="system-health-page-card">
          <h3>Monitoring Snapshot</h3>
          <div className="system-health-page-metrics">
            <span>Realtime: {connected ? "Live" : "Disconnected"}</span>
            <span>Window: {toNumber(resolvedMonitoring.windowMs) / 1000 || 0}s</span>
            <span>Updated: {formatUpdatedAt(resolvedMonitoring.updatedAt)}</span>
            <span>Requests: {toNumber(resolvedMonitoring.totalRequests)}</span>
            <span>Errors: {toNumber(resolvedMonitoring.totalErrors)}</span>
            <span>Throttled: {toNumber(resolvedMonitoring.totalThrottled)}</span>
            <span>Slow: {toNumber(resolvedMonitoring.totalSlow)}</span>
            <span>Error Rate: {asPercent(resolvedMonitoring.errorRate)}</span>
            <span>Slow Rate: {asPercent(resolvedMonitoring.slowRate)}</span>
            <span>RPS: {toNumber(resolvedMonitoring.rps).toFixed(2)}</span>
            <span>Active Endpoints: {toNumber(resolvedMonitoring.activeEndpoints)}</span>
            <span>Latency Degraded: {toNumber(resolvedMonitoring.latencyDegradedEndpointCount)}</span>
            <span>Critical Degraded: {toNumber(resolvedMonitoring.degradedEndpointCount)}</span>
            <span>DDoS Signals: {toNumber(resolvedMonitoring.suspectedDdosEndpointCount)}</span>
          </div>
        </article>

        <article className="system-health-page-card">
          <h3>Host Telemetry</h3>
          <div className="system-health-page-metrics">
            <span>OS: {resolvedStats.os || "N/A"}</span>
            <span>CPU: {resolvedStats.cpu || "N/A"}</span>
            <span>RAM: {resolvedStats.ram || "N/A"}</span>
            <span>Swap: {resolvedStats.swap || "N/A"}</span>
            <span>GPU: {resolvedStats.gpu || "N/A"}</span>
            <span>Public IP: {resolvedStats.publicIP || "N/A"}</span>
            <span>Private IP: {resolvedStats.privateIP || "N/A"}</span>
            <span>Location: {resolvedStats.location || "N/A"}</span>
          </div>
        </article>
      </div>

      <div className="system-health-page-grid">
        <article className="system-health-page-card">
          <h3>Top Failing Endpoints</h3>
          {topFailingEndpoints.length === 0 ? (
            <p className="system-health-empty">No failing endpoints in the active window.</p>
          ) : (
            <ul className="system-health-list">
              {topFailingEndpoints.map((item) => (
                <li key={item.endpoint}>
                  <span>{item.endpoint}</span>
                  <span>{toNumber(item.errorCount)} errors</span>
                  <span>{asPercent(item.errorRate)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="system-health-page-card">
          <h3>Top Busy Endpoints</h3>
          {topBusyEndpoints.length === 0 ? (
            <p className="system-health-empty">No busy endpoints in the active window.</p>
          ) : (
            <ul className="system-health-list">
              {topBusyEndpoints.map((item) => (
                <li key={item.endpoint}>
                  <span>{item.endpoint}</span>
                  <span>{toNumber(item.requestCount)} req</span>
                  <span>{asPercent(item.slowRate)}</span>
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
};

export default SystemHealth;
