const toNumber = (value) => {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
};

const parsePercentValue = (rawValue) => {
  if (typeof rawValue !== 'string') return 0;
  return toNumber(rawValue.replace('%', '').trim());
};

const asPercent = (value) => `${(toNumber(value) * 100).toFixed(1)}%`;

const resolveSystemHealth = ({ connected, monitoring, stats }) => {
  const degradedEndpointCount = toNumber(monitoring?.degradedEndpointCount);
  const suspectedDdosEndpointCount = toNumber(monitoring?.suspectedDdosEndpointCount);
  const latencyDegradedEndpointCount = toNumber(monitoring?.latencyDegradedEndpointCount);
  const errorRate = toNumber(monitoring?.errorRate);
  const slowRate = toNumber(monitoring?.slowRate);

  const cpuLoad = parsePercentValue(stats?.cpu);
  const ramLoad = parsePercentValue(stats?.ram);
  const swapLoad = parsePercentValue(stats?.swap);

  if (!connected) {
    return {
      level: 'red',
      label: 'Realtime Down',
      detail: 'Health feed is disconnected. Live status may be stale.',
    };
  }

  if (degradedEndpointCount > 0 || suspectedDdosEndpointCount > 0 || errorRate >= 0.4) {
    return {
      level: 'red',
      label: 'Critical',
      detail: 'At least one service is down or heavily degraded.',
    };
  }

  if (
    latencyDegradedEndpointCount > 0 ||
    errorRate >= 0.12 ||
    slowRate >= 0.25 ||
    cpuLoad >= 90 ||
    ramLoad >= 90 ||
    swapLoad >= 90
  ) {
    return {
      level: 'yellow',
      label: 'Degraded',
      detail: 'Services are reachable but performance is impacted.',
    };
  }

  return {
    level: 'green',
    label: 'All Operational',
    detail: 'All tracked systems are operating normally.',
  };
};

export { toNumber, parsePercentValue, asPercent, resolveSystemHealth };
