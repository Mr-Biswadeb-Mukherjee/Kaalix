// statusCore.js
import os from 'os';
import si from 'systeminformation';
import fetch from 'node-fetch';

let cachedStats = {
  os: `${os.type()} ${os.release()}`,
  cpu: 'N/A',
  ram: 'N/A',
  swap: 'N/A',
  gpu: 'N/A',
  publicIP: 'N/A',
  privateIP: 'N/A',
  location: 'N/A'
};

let cachedPublicIP = 'N/A';
let cachedLocation = 'N/A';
let lastIPFetch = 0;
let networkWasDown = false;

// Get private IPv4 address
function getPrivateIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address) {
        return iface.address;
      }
    }
  }
  return 'N/A';
}

// Check if machine is offline (no active non-internal interfaces)
function isOffline() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal && iface.address) {
        return false; // At least one active interface
      }
    }
  }
  return true; // No active non-internal interfaces
}

// Fetch public IP and location (only if online)
async function fetchPublicIPAndLocation() {
  try {
    if (isOffline()) {
      if (!networkWasDown) {
        console.warn('Machine is offline, skipping public IP & location fetch.');
        networkWasDown = true;
      }
      return { publicIP: cachedPublicIP, location: cachedLocation };
    }

    networkWasDown = false;
    const now = Date.now();

    // Return cached values if fetched recently
    if (now - lastIPFetch < 5 * 60 * 1000 && cachedPublicIP !== 'N/A') {
      return { publicIP: cachedPublicIP, location: cachedLocation };
    }

    let publicIP = 'N/A';

    // Try primary service: ifconfig.me
    try {
      const res = await fetch('https://ifconfig.me/ip');
      if (res.ok) publicIP = (await res.text()).trim();
    } catch {
      // Fallback: api.ipify.org
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        publicIP = data.ip || 'N/A';
      } catch (err2) {
        console.error('Failed to fetch public IP from both services:', err2);
      }
    }

    cachedPublicIP = publicIP;

    let location = 'N/A';
    if (cachedPublicIP !== 'N/A') {
      try {
        const locRes = await fetch(`http://ip-api.com/json/${cachedPublicIP}`);
        const locData = await locRes.json();
        if (locData.status === 'success') {
          location = `${locData.city}, ${locData.regionName}, ${locData.country}`;
        }
      } catch (locErr) {
        console.error('Failed to fetch location:', locErr);
      }
    }

    cachedLocation = location;
    lastIPFetch = now;

    return { publicIP, location };
  } catch (err) {
    console.error('Failed to fetch public IP & location:', err);
    return { publicIP: cachedPublicIP, location: cachedLocation };
  }
}

// Probe system stats (CPU, RAM, Swap, GPU, IPs)
async function probeSystemStats() {
  try {
    const [cpuLoad, mem, gpu] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.graphics()
    ]);

    const { publicIP, location } = await fetchPublicIPAndLocation();
    const privateIP = getPrivateIP();

    cachedStats = {
      os: `${os.type()} ${os.release()}`,
      cpu: `${cpuLoad.currentLoad.toFixed(2)}%`,
      ram: `${((mem.active / mem.total) * 100).toFixed(2)}%`,
      swap: mem.swaptotal > 0
        ? `${((mem.swapused / mem.swaptotal) * 100).toFixed(2)}%`
        : '0%',
      gpu: gpu.controllers.length
        ? `${gpu.controllers[0].utilizationGpu || 0}%`
        : 'N/A',
      publicIP,
      privateIP,
      location
    };
  } catch (err) {
    console.error('Failed to probe system stats:', err);
  }
}

// Refresh system stats every 5 seconds
setInterval(probeSystemStats, 5000);

// Run immediately at startup
probeSystemStats();

// Get latest cached system stats
function getSystemStats() {
  return cachedStats;
}

// Get public IP & location (can be used separately)
async function getPublicIPAndLocation() {
  return await fetchPublicIPAndLocation();
}

// Reset cached public IP & location (on logout)
function resetPublicIPAndLocation() {
  cachedPublicIP = 'N/A';
  cachedLocation = 'N/A';
  lastIPFetch = 0;
  cachedStats.publicIP = 'N/A';
  cachedStats.privateIP = 'N/A';
  cachedStats.location = 'N/A';
}

export { getSystemStats, resetPublicIPAndLocation, getPublicIPAndLocation };
export default getSystemStats;
