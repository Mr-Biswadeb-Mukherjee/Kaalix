import './Styles/statusBar.css';

import { useNavigate } from 'react-router-dom';
import { useRealtime } from '../../Context/RealtimeContext';
import { resolveSystemHealth } from '../../Utils/systemHealth';

const StatusBar = ({ collapsed }) => {
  const navigate = useNavigate();
  const { connected, monitoring, stats } = useRealtime();

  const resolvedStats = stats || {};
  const resolvedMonitoring = monitoring || {};
  const health = resolveSystemHealth({
    connected,
    monitoring: resolvedMonitoring,
    stats: resolvedStats,
  });

  return (
    <div className={`status-bar ${collapsed ? 'collapsed' : ''}`}>
      <button
        type="button"
        className={`status-health-trigger ${health.level}`}
        onClick={() => navigate('/system-health')}
        title="Open detailed system health view"
      >
        <span className="status-health-label">System Health</span>
        <span className="status-health-lights" aria-hidden="true">
          <span className={`status-health-light green ${health.level === 'green' ? 'active' : ''}`} />
          <span className={`status-health-light yellow ${health.level === 'yellow' ? 'active' : ''}`} />
          <span className={`status-health-light red ${health.level === 'red' ? 'active' : ''}`} />
        </span>
        <span className="status-health-text">{health.label}</span>
      </button>
    </div>
  );
};

export default StatusBar;
