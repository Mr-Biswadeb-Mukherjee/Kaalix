import { listEngineCollectors } from "./intelEngine.service.js";
import { getIntelApiKeyStatus } from "./intelApiKey.service.js";

const normalizeErrorReason = (err) => {
  if (typeof err?.details === "string" && err.details.trim()) {
    return err.details.trim();
  }
  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  return "Unknown engine connectivity failure";
};

export const checkIntelInternetConnectivity = async () => {
  const startedAt = Date.now();
  const checks = { engineProcess: false, collectorsRegistered: false };
  const failures = [];
  let collectorCount = 0;
  const apiKeyStatus = await getIntelApiKeyStatus();

  try {
    const payload = await listEngineCollectors();
    checks.engineProcess = true;
    collectorCount = Array.isArray(payload?.collectors) ? payload.collectors.length : 0;
    checks.collectorsRegistered = collectorCount > 0;
    if (!checks.collectorsRegistered) {
      failures.push("collectors:No collectors registered in KaaliX engine");
    }
  } catch (err) {
    failures.push(`engine:${normalizeErrorReason(err)}`);
  }

  const connected = checks.engineProcess && checks.collectorsRegistered;
  if (!connected && !apiKeyStatus.configured) {
    failures.unshift("serpapi_key:No SerpAPI key configured");
  }

  return {
    connected,
    checks,
    collectorCount,
    apiKeyConfigured: apiKeyStatus.configured,
    apiKeySource: apiKeyStatus.source,
    maskedApiKey: apiKeyStatus.maskedKey,
    checkedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Date.now() - startedAt),
    failureReasons: connected ? [] : failures,
  };
};

export default checkIntelInternetConnectivity;
