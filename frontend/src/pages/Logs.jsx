import { useState, useRef, useEffect } from 'react';
import './Styles/Logs.css';

const Logs = () => {
  const [logsEnabled, setLogsEnabled] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [viewMode, setViewMode] = useState("table");
  const [requestError, setRequestError] = useState("");

  const toggleRef = useRef(null);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState(0);

  // Fetch current logging status on mount
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const res = await fetch('/api/logging/status');
        const data = await res.json();
        setLogsEnabled(data.enabled);
        setRequestError("");
      } catch {
        setRequestError("Failed to fetch logging status.");
      }
    };
    fetchStatus();
  }, []);

  // Handle toggle switch click
  const handleToggleClick = async () => {
    setIsPending(true);
    try {
      const res = await fetch('/api/logging/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !logsEnabled })
      });
      if (res.ok) {
        setLogsEnabled(!logsEnabled);
        setRequestError("");
      } else {
        setRequestError("Failed to toggle logging.");
      }
    } catch {
      setRequestError("Failed to toggle logging.");
    } finally {
      setIsPending(false);
    }
  };

  const switchStateClass = isPending
    ? 'switch-pending'
    : logsEnabled
    ? 'switch-on'
    : 'switch-off';

  /* Drag handlers for view mode */
  const startDrag = () => setDragging(true);
  const onDrag = (e) => {
    if (!dragging || !toggleRef.current) return;
    const rect = toggleRef.current.getBoundingClientRect();
    let x = e.clientX - rect.left;
    x = Math.max(0, Math.min(x, rect.width));
    setDragX(x);
  };
  const endDrag = () => {
    if (!dragging || !toggleRef.current) return;
    const rect = toggleRef.current.getBoundingClientRect();
    setViewMode(dragX < rect.width / 2 ? "table" : "studio");
    setDragging(false);
    setDragX(0);
  };

  useEffect(() => {
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);
    return () => {
      window.removeEventListener('mousemove', onDrag);
      window.removeEventListener('mouseup', endDrag);
    };
  });

  return (
    <div className="page-container">
      <h1>Logs</h1>

      <div className="logs-header">
        <span>View and manage application logs here.</span>
        <div className="logs-controls">
          {logsEnabled && (
            <div
              className="view-mode-toggle"
              ref={toggleRef}
              onMouseDown={startDrag}
            >
              <div
                className={`highlight`}
                style={{
                  left: dragging
                    ? dragX - toggleRef.current.offsetWidth / 4
                    : viewMode === "table" ? 0 : "50%",
                  transition: dragging ? "none" : "left 0.35s cubic-bezier(0.25, 1.25, 0.5, 1)"
                }}
              ></div>
              <button
                className={viewMode === "table" ? "active" : ""}
                onClick={() => setViewMode("table")}
              >
                Table
              </button>
              <button
                className={viewMode === "studio" ? "active" : ""}
                onClick={() => setViewMode("studio")}
              >
                Terminal
              </button>
            </div>
          )}

          <label className={`switch ${switchStateClass}`}>
            <input
              type="checkbox"
              checked={logsEnabled}
              onChange={handleToggleClick}
              disabled={isPending}
            />
            <span className="slider round"></span>
          </label>
          <span className="toggle-text">
            {isPending ? "Processing..." : logsEnabled ? "On" : "Off"}
          </span>
        </div>
      </div>
      {requestError && <p className="logs-error">{requestError}</p>}

      {logsEnabled && (
        <div className="logs-container">
          {viewMode === "table" ? (
            <table className="logs-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Level</th>
                  <th>Message</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>2025-09-28 11:30</td>
                  <td>INFO</td>
                  <td>Application started</td>
                </tr>
                <tr>
                  <td>2025-09-28 11:32</td>
                  <td>WARN</td>
                  <td>Low memory detected</td>
                </tr>
              </tbody>
            </table>
          ) : (
            <div className="studio-mode">
              <pre>
{`[2025-09-28 11:30] INFO: Application started
[2025-09-28 11:32] WARN: Low memory detected`}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Logs;
