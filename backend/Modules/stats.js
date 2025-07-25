//Modules/stats.js

import express from 'express';
import os from 'os';
import si from 'systeminformation';
import APIs from '../APIs/APIs.js';

const router = express.Router();

const { endpoint } = APIs.system.statsV3;

// Utility: Get local IPv4 address
const getLocalIPv4 = () => {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return null;
};

// Utility: Format bytes to GB
const formatGB = (bytes) => `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;

// Route Handler
router.post(endpoint, async (req, res) => {
  try {
    const [cpuLoad, mem, graphics, osInfo] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.graphics(),
      si.osInfo()
    ]);

    const cpu = `${cpuLoad.currentLoad.toFixed(1)}%`;
    const ram = `${formatGB(mem.used)} / ${formatGB(mem.total)}`;
    const swap = `${formatGB(mem.swapused)} / ${formatGB(mem.swaptotal)}`;
    const osName = `${osInfo.distro} ${osInfo.release}`;
    const ipRaw = getLocalIPv4();
    const ip = ipRaw && ipRaw !== '0.0.0.0' ? ipRaw : 'Unavailable';

    let gpu = 'Unavailable';
    if (
      graphics.controllers &&
      graphics.controllers.length > 0 &&
      typeof graphics.controllers[0].memoryUsed === 'number' &&
      typeof graphics.controllers[0].memoryTotal === 'number'
    ) {
      const used = graphics.controllers[0].memoryUsed;
      const total = graphics.controllers[0].memoryTotal;
      gpu = `${formatGB(used)} / ${formatGB(total)}`;
    }

    res.json({ os: osName, cpu, ram, swap, gpu, ip });
  } catch (err) {
    console.error('❌ Failed to retrieve system stats:', err);
    res.status(500).json({ error: 'Failed to retrieve system stats' });
  }
});

export default router;
