import { useRealtime } from '../../Context/RealtimeContext';
import { asPercent, resolveSystemHealth, toNumber } from '../../Utils/systemHealth';
import './Styles/SystemHealthWidget.css';

const SystemHealthWidget = () => {
  const { connected, monitoring, stats } = useRealtime();
  const resolvedStats = stats || {};
  const resolvedMonitoring = monitoring || {};

  const health = resolveSystemHealth({
    connected,
    monitoring: resolvedMonitoring,
    stats: resolvedStats,
  });

  const updatedLabel = (() => {
    const updatedAt = resolvedMonitoring.updatedAt;
    if (!updatedAt) return 'waiting for feed';
    const date = new Date(updatedAt);
    if (Number.isNaN(date.getTime())) return 'waiting for feed';
    return `updated ${date.toLocaleTimeString()}`;
  })();

  return (
    <article className={`system-health-widget ${health.level}`} aria-live="polite">
      <header className="system-health-head">
        <div>
          <p className="system-health-kicker">Operations</p>
          <h2>System Health</h2>
        </div>
        <span className="system-health-updated">{updatedLabel}</span>
      </header>

      <div className="system-health-signal" title={health.detail}>
        <div className="system-health-lights" aria-hidden="true">
          <span className={`system-health-light green ${health.level === 'green' ? 'active' : ''}`} />
          <span className={`system-health-light yellow ${health.level === 'yellow' ? 'active' : ''}`} />
          <span className={`system-health-light red ${health.level === 'red' ? 'active' : ''}`} />
        </div>
        <div className="system-health-copy">
          <strong>{health.label}</strong>
          <span>{health.detail}</span>
        </div>
      </div>

      <div className="system-health-metrics">
        <span>Realtime: {connected ? 'Live' : 'Disconnected'}</span>
        <span>Error Rate: {asPercent(resolvedMonitoring.errorRate)}</span>
        <span>Slow Rate: {asPercent(resolvedMonitoring.slowRate)}</span>
        <span>Degraded APIs: {toNumber(resolvedMonitoring.degradedEndpointCount)}</span>
        <span>DDoS Signals: {toNumber(resolvedMonitoring.suspectedDdosEndpointCount)}</span>
        <span>CPU: {resolvedStats.cpu || 'N/A'}</span>
      </div>
    </article>
  );
};

export default SystemHealthWidget;
