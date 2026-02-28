import { useState } from "react";
import Toggle from '@mui/material/Switch';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import {
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Button,
  CircularProgress,
} from '@mui/material';
import './Styles/LogForwarder.css';

const LogForwarder = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState("inactive");
  const [forwarderType, setForwarderType] = useState("syslog");
  const [config, setConfig] = useState({
    host: '',
    port: '',
    tenantId: '',
    token: '',
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);

  const handleToggle = (event) => {
    const enabled = event.target.checked;
    setIsEnabled(enabled);

    if (enabled) {
      setStatus("connecting");
      setTimeout(() => setStatus("active"), 1000);
    } else {
      setStatus("inactive");
    }
  };

  const handleTestRoute = () => {
    setIsTesting(true);
    setTestResult(null);

    setTimeout(() => {
      const success = Math.random() > 0.3;
      setTestResult(success ? "success" : "failed");
      setIsTesting(false);
    }, 1500);
  };

  const handleInputChange = (field) => (event) => {
    setConfig({ ...config, [field]: event.target.value });
  };

  const handleSaveConfiguration = () => {
    console.log("Saving forwarder configuration:", config, forwarderType);
    alert("Log forwarder configuration saved.");
  };

  const showAdvancedFields = forwarderType === "kafka" || forwarderType === "custom";

  return (
    <section className="forwarder-container">
      <h1 className="forwarder-title">Log Forwarder</h1>
      <p className="forwarder-subtitle">Manage secure telemetry transport into your SIEM ingestion pipeline.</p>

      <div className="forwarder-top-row">
        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel id="forwarder-type-label" sx={{ color: "var(--text-color)" }}>Forwarder Type</InputLabel>
          <Select
            labelId="forwarder-type-label"
            value={forwarderType}
            onChange={(e) => setForwarderType(e.target.value)}
            label="Forwarder Type"
            sx={{
              color: "var(--text-color)",
              '.MuiOutlinedInput-notchedOutline': { borderColor: "var(--border-color)" },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--accent-color)' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: 'var(--accent-color)' },
              '.MuiSvgIcon-root': { color: 'var(--text-color)' },
              backgroundColor: "var(--bg-color)",
              borderRadius: 2,
            }}
          >
            <MenuItem value="syslog">Syslog TLS</MenuItem>
            <MenuItem value="http">HTTPS Push</MenuItem>
            <MenuItem value="kafka">Kafka Connector</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </Select>
        </FormControl>

        <div className="forwarder-status-leds">
          <FiberManualRecordIcon style={{ color: status === 'active' ? '#22c55e' : '#555' }} fontSize="small" />
          <FiberManualRecordIcon style={{ color: status === 'connecting' ? '#facc15' : '#555' }} fontSize="small" />
          <FiberManualRecordIcon style={{ color: status === 'inactive' ? '#ef4444' : '#555' }} fontSize="small" />
          <span className="forwarder-status-text">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>

        <div className="forwarder-toggle-switch">
          <span className="forwarder-toggle-label">Enable Forwarder</span>
          <Toggle
            checked={isEnabled}
            onChange={handleToggle}
            color="warning"
            sx={{
              '& .MuiSwitch-thumb': {
                backgroundColor: isEnabled ? '#f43f5e' : '#999',
              },
              '& .MuiSwitch-track': {
                backgroundColor: '#333',
              },
            }}
          />
        </div>
      </div>

      <div className="forwarder-form-section">
        {showAdvancedFields && (
          <>
            <div className="forwarder-inputs-grid">
              <TextField
                label="Ingestion Host"
                variant="outlined"
                value={config.host}
                onChange={handleInputChange('host')}
                sx={{ input: { color: "var(--text-color)" } }}
                fullWidth
              />
              <TextField
                label="Port"
                variant="outlined"
                value={config.port}
                onChange={handleInputChange('port')}
                sx={{ input: { color: "var(--text-color)" } }}
                fullWidth
              />
              <TextField
                label="Tenant ID"
                variant="outlined"
                value={config.tenantId}
                onChange={handleInputChange('tenantId')}
                sx={{ input: { color: "var(--text-color)" } }}
                fullWidth
              />
              <TextField
                label="API Token"
                type="password"
                variant="outlined"
                value={config.token}
                onChange={handleInputChange('token')}
                sx={{ input: { color: "var(--text-color)" } }}
                fullWidth
              />
            </div>

            <div className="forwarder-actions-row">
              <Button
                variant="contained"
                color="primary"
                sx={{ borderRadius: 2 }}
                onClick={handleTestRoute}
                disabled={isTesting}
              >
                {isTesting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : "Test Route"}
              </Button>

              <Button
                variant="contained"
                color="success"
                sx={{ borderRadius: 2 }}
                onClick={handleSaveConfiguration}
                disabled={testResult !== "success"}
              >
                Save Configuration
              </Button>
            </div>

            {testResult === "success" && <p className="test-success">Route test successful.</p>}
            {testResult === "failed" && <p className="test-failed">Route test failed.</p>}
          </>
        )}
      </div>
    </section>
  );
};

export default LogForwarder;
