import dns from "node:dns/promises";
import fetch from "node-fetch";

const DNS_PROBE_HOST = "example.com";
const HTTP_PROBE_URL = "https://example.com";
const PROBE_TIMEOUT_MS = 4500;

const runWithTimeout = async (promiseFactory, timeoutMs, timeoutMessage) =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(timeoutMessage)), timeoutMs);

    Promise.resolve()
      .then(() => promiseFactory())
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });

const checkDnsConnectivity = async () => {
  await runWithTimeout(
    () => dns.lookup(DNS_PROBE_HOST),
    PROBE_TIMEOUT_MS,
    "DNS probe timed out"
  );
  return true;
};

const checkHttpsConnectivity = async () => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);

  try {
    const response = await fetch(HTTP_PROBE_URL, {
      method: "GET",
      signal: controller.signal,
      headers: {
        "User-Agent": "KaaliX-Intel-Connectivity/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTPS probe failed with status ${response.status}`);
    }

    return true;
  } finally {
    clearTimeout(timer);
  }
};

const normalizeErrorReason = (err) => {
  if (typeof err?.message === "string" && err.message.trim()) {
    return err.message.trim();
  }
  return "Unknown connectivity failure";
};

export const checkIntelInternetConnectivity = async () => {
  const startedAt = Date.now();
  const failures = [];
  const checks = { dns: false, https: false };

  try {
    await checkDnsConnectivity();
    checks.dns = true;
  } catch (err) {
    failures.push(`dns:${normalizeErrorReason(err)}`);
  }

  try {
    await checkHttpsConnectivity();
    checks.https = true;
  } catch (err) {
    failures.push(`https:${normalizeErrorReason(err)}`);
  }

  const connected = checks.dns || checks.https;

  return {
    connected,
    checks,
    checkedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Date.now() - startedAt),
    failureReasons: connected ? [] : failures,
  };
};

export default checkIntelInternetConnectivity;
