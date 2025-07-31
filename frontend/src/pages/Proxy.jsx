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
import './Styles/Proxy.css';

const Proxy = () => {
  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState("inactive"); // 'inactive', 'connecting', 'active'
  const [proxyType, setProxyType] = useState("http");
  const [customData, setCustomData] = useState({
    ip: '',
    port: '',
    username: '',
    password: '',
  });
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // 'success', 'failed', or null

  const handleToggle = (event) => {
    const val = event.target.checked;
    setIsEnabled(val);
    if (val) {
      setStatus("connecting");
      setTimeout(() => setStatus("active"), 1000);
    } else {
      setStatus("inactive");
    }
  };

  const handleTestConnection = () => {
    setIsTesting(true);
    setTestResult(null);

    setTimeout(() => {
      const success = Math.random() > 0.3;
      setTestResult(success ? "success" : "failed");
      setIsTesting(false);
    }, 1500);
  };

  const handleInputChange = (field) => (event) => {
    setCustomData({ ...customData, [field]: event.target.value });
  };

  const handleSaveSettings = () => {
    // Replace with actual logic for saving the settings
    console.log("Saving settings:", customData, proxyType);
    alert("Settings saved successfully!");
  };

  return (
    <div className="proxy-container">
      <h1 className="proxy-title">Proxy</h1>
      <p className="proxy-subtitle">Configure and manage your proxy settings.</p>

      {/* Top Row: Dropdown + LED + Toggle */}
      <div className="proxy-top-row">
        <FormControl sx={{ minWidth: 120 }} size="small">
          <InputLabel id="proxy-type-label" sx={{ color: "#ccc" }}>Proxy Type</InputLabel>
          <Select
            labelId="proxy-type-label"
            value={proxyType}
            onChange={(e) => setProxyType(e.target.value)}
            label="Proxy Type"
            sx={{
              color: "--text-color",
              '.MuiOutlinedInput-notchedOutline': { borderColor: "--border-color" },
              '&.Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '--border-color' },
              '&:hover .MuiOutlinedInput-notchedOutline': { borderColor: '--border-color' },
              '.MuiSvgIcon-root': { color: '#999' },
              backgroundColor: "--bg-color",
              borderRadius: 2,
            }}
          >
            <MenuItem value="http">HTTP</MenuItem>
            <MenuItem value="https">HTTPS</MenuItem>
            <MenuItem value="socks">SOCKS</MenuItem>
            <MenuItem value="elite">Elite</MenuItem>
            <MenuItem value="custom">Custom</MenuItem>
          </Select>
        </FormControl>

        {/* LED Status */}
        <div className="proxy-status-leds">
          <FiberManualRecordIcon style={{ color: status === 'active' ? '#22c55e' : '#555' }} fontSize="small" />
          <FiberManualRecordIcon style={{ color: status === 'connecting' ? '#facc15' : '#555' }} fontSize="small" />
          <FiberManualRecordIcon style={{ color: status === 'inactive' ? '#ef4444' : '#555' }} fontSize="small" />
          <span className="proxy-status-text">{status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>

        {/* Toggle */}
        <div className="proxy-toggle-switch">
          <span className="proxy-toggle-label">Enable Proxy</span>
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

      {/* Proxy Form Section */}
      <div className="proxy-form-section">
        {(proxyType === "custom" || proxyType === "socks" || proxyType === "elite") && (
          <>
            <div className="proxy-inputs-grid">
              <TextField
                label="IP Address"
                variant="outlined"
                value={customData.ip}
                onChange={handleInputChange('ip')}
                sx={{ input: { color: "#fff" } }}
                fullWidth
              />
              <TextField
                label="Port"
                variant="outlined"
                value={customData.port}
                onChange={handleInputChange('port')}
                sx={{ input: { color: "#fff" } }}
                fullWidth
              />
              <TextField
                label="Username"
                variant="outlined"
                value={customData.username}
                onChange={handleInputChange('username')}
                sx={{ input: { color: "#fff" } }}
                fullWidth
              />
              <TextField
                label="Password"
                type="password"
                variant="outlined"
                value={customData.password}
                onChange={handleInputChange('password')}
                sx={{ input: { color: "#fff" } }}
                fullWidth
              />
            </div>

            {/* Test + Save Row */}
            <div className="proxy-actions-row">
              <Button
                variant="contained"
                color="error"
                sx={{ borderRadius: 2 }}
                onClick={handleTestConnection}
                disabled={isTesting}
              >
                {isTesting ? <CircularProgress size={20} sx={{ color: '#fff' }} /> : "Test Connection"}
              </Button>

              <Button
                variant="contained"
                color="success"
                sx={{ borderRadius: 2 }}
                onClick={handleSaveSettings}
                disabled={testResult !== "success"}
              >
                Save Settings
              </Button>
            </div>

            {/* Test result */}
            {testResult === "success" && <p className="test-success">✅ Connection successful</p>}
            {testResult === "failed" && <p className="test-failed">❌ Connection failed</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default Proxy;
