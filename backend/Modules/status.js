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

// Cache for public IP + location (memory only, reset on restart/logout)
let cachedPublicIP = 'N/A';
let cachedLocation = 'N/A';
let lastIPFetch = 0;

function getPrivateIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'N/A';
}

async function fetchPublicIPAndLocation() {
  try {
    const now = Date.now();

    // Only refresh if 15 min passed or not set yet
    if (now - lastIPFetch < 15 * 60 * 1000 && cachedPublicIP !== 'N/A') {
      return { publicIP: cachedPublicIP, location: cachedLocation };
    }

    // 1. Get Public IP
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipRes.json();
    cachedPublicIP = ipData.ip || 'N/A';

    // 2. Get Location from IP
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

    return { publicIP: cachedPublicIP, location: cachedLocation };
  } catch (err) {
    console.error('Failed to fetch public IP & location:', err);
    return { publicIP: cachedPublicIP, location: cachedLocation };
  }
}

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

// Refresh system stats every 5s
setInterval(probeSystemStats, 100);

// Run immediately at startup
probeSystemStats();

function getSystemStats() {
  return cachedStats;
}

// 👇 Clears cached public IP + location (call this on logout)
function resetPublicIPAndLocation() {
  cachedPublicIP = 'N/A';
  cachedLocation = 'N/A';
  lastIPFetch = 0;
  cachedStats.publicIP = 'N/A';
  cachedStats.privateIP = 'N/A';
  cachedStats.location = 'N/A';
}

export { getSystemStats, resetPublicIPAndLocation };
export default getSystemStats;
