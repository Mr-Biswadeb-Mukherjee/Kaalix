import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "@amon/shared";
import "./Styles/ThreatIntelSettings.css";
import { getBackendErrorMessage, parseApiResponse } from "../Utils/apiError";

const INTEL_RECENT_SEARCH_MAX = 18;
const INTEL_ACTIVITY_FETCH_LIMIT = 60;
const INTEL_SEARCH_ACTIVITY_SUCCESS = "intel.search_success";
const INTEL_SEARCH_ACTIVITY_FAILED = "intel.search_failed";

const formatRecentSearchTime = (value) => {
  if (!value) return "Unknown time";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown time";
  return parsed.toLocaleString();
};

const extractQuotedSearchQuery = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  const match = text.match(/"([^"]+)"/);
  return match && typeof match[1] === "string" ? match[1].trim() : "";
};

const resolveIntelSearchQuery = (activity) => {
  const metadataQuery =
    typeof activity?.metadata?.query === "string" ? activity.metadata.query.trim() : "";
  if (metadataQuery) return metadataQuery;

  const quotedDescriptionQuery = extractQuotedSearchQuery(activity?.description);
  if (quotedDescriptionQuery) return quotedDescriptionQuery;

  return "";
};

const buildRecentIntelSearches = (activities = []) => {
  const results = [];
  const seen = new Set();

  for (const activity of Array.isArray(activities) ? activities : []) {
    const activityType = String(activity?.activityType || "").trim().toLowerCase();
    if (activityType !== INTEL_SEARCH_ACTIVITY_SUCCESS && activityType !== INTEL_SEARCH_ACTIVITY_FAILED) {
      continue;
    }

    const query = resolveIntelSearchQuery(activity);
    if (!query) continue;

    const dedupeKey = query.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    results.push({
      id:
        typeof activity?.activityId === "string" && activity.activityId.trim()
          ? activity.activityId.trim()
          : `${activityType}:${dedupeKey}:${results.length}`,
      query,
      status: activityType === INTEL_SEARCH_ACTIVITY_FAILED ? "failed" : "success",
      occurredAt: activity?.occurredAt || null,
    });

    if (results.length >= INTEL_RECENT_SEARCH_MAX) break;
  }

  return results;
};

const ThreatIntelSettings = () => {
  const [intelConnected, setIntelConnected] = useState(false);
  const [intelConnecting, setIntelConnecting] = useState(false);
  const [intelConnectionMessage, setIntelConnectionMessage] = useState(
    "KaaliX Intelligence is offline. Connect engine to enable search."
  );

  const [intelApiKeyInput, setIntelApiKeyInput] = useState("");
  const [intelApiKeySaving, setIntelApiKeySaving] = useState(false);
  const [intelApiKeyError, setIntelApiKeyError] = useState("");
  const [intelApiKeyMessage, setIntelApiKeyMessage] = useState("");
  const [intelMaskedApiKey, setIntelMaskedApiKey] = useState("");

  const [intelRecentSearches, setIntelRecentSearches] = useState([]);
  const [intelRecentSearchesLoading, setIntelRecentSearchesLoading] = useState(false);
  const [intelRecentSearchesError, setIntelRecentSearchesError] = useState("");

  const requestIntelConnectivity = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Missing session token. Please log in again.");
    }

    const response = await fetch(API.system.protected.intelConnectivity.endpoint, {
      method: API.system.protected.intelConnectivity.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    return parseApiResponse(response, { requireSuccess: true });
  }, []);

  const requestIntelSerpApiKeyStatus = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Missing session token. Please log in again.");
    }

    const response = await fetch(API.system.protected.intelSerpApiKeyStatus.endpoint, {
      method: API.system.protected.intelSerpApiKeyStatus.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    return parseApiResponse(response, { requireSuccess: true });
  }, []);

  const requestIntelSerpApiKeySave = useCallback(async ({ apiKey = "", clear = false } = {}) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Missing session token. Please log in again.");
    }

    const response = await fetch(API.system.protected.intelSerpApiKey.endpoint, {
      method: API.system.protected.intelSerpApiKey.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        apiKey,
        clear,
      }),
    });

    return parseApiResponse(response, { requireSuccess: true });
  }, []);

  const requestIntelRecentSearches = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Missing session token. Please log in again.");
    }

    const response = await fetch(
      `${API.system.protected.activityLogs.endpoint}?limit=${INTEL_ACTIVITY_FETCH_LIMIT}`,
      {
        method: API.system.protected.activityLogs.method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    const data = await parseApiResponse(response, { requireSuccess: true });
    return buildRecentIntelSearches(Array.isArray(data?.activities) ? data.activities : []);
  }, []);

  const loadIntelRecentSearches = useCallback(async () => {
    setIntelRecentSearchesLoading(true);
    setIntelRecentSearchesError("");

    try {
      const rows = await requestIntelRecentSearches();
      setIntelRecentSearches(rows);
      setIntelRecentSearchesError("");
    } catch (err) {
      setIntelRecentSearchesError(getBackendErrorMessage(err));
    } finally {
      setIntelRecentSearchesLoading(false);
    }
  }, [requestIntelRecentSearches]);

  const applyConnectivitySnapshot = useCallback((connectivity) => {
    const connected = Boolean(connectivity?.connected);
    setIntelConnected(connected);
    if (connected) {
      setIntelConnectionMessage(
        typeof connectivity?.message === "string" && connectivity.message.trim()
          ? connectivity.message
          : "KaaliX Intelligence engine is ready."
      );
      return;
    }

    const reasons = Array.isArray(connectivity?.failureReasons) ? connectivity.failureReasons : [];
    const suffix = reasons.length > 0 ? ` (${reasons.join(", ")})` : "";
    setIntelConnectionMessage(`KaaliX Intelligence engine is not ready.${suffix}`);
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [apiStatus, connectivity] = await Promise.all([
          requestIntelSerpApiKeyStatus(),
          requestIntelConnectivity(),
        ]);

        if (cancelled) return;

        setIntelMaskedApiKey(typeof apiStatus?.maskedApiKey === "string" ? apiStatus.maskedApiKey : "");
        applyConnectivitySnapshot(connectivity);
      } catch (err) {
        if (cancelled) return;
        setIntelConnectionMessage(getBackendErrorMessage(err));
      }
    })();

    void loadIntelRecentSearches();

    return () => {
      cancelled = true;
    };
  }, [applyConnectivitySnapshot, loadIntelRecentSearches, requestIntelConnectivity, requestIntelSerpApiKeyStatus]);

  const handleIntelConnectionToggle = useCallback(
    async (nextChecked) => {
      if (intelConnecting) return;

      if (!nextChecked) {
        setIntelConnected(false);
        setIntelConnectionMessage("KaaliX Intelligence is offline.");
        return;
      }

      setIntelConnected(true);
      setIntelConnecting(true);
      setIntelConnectionMessage("Checking KaaliX engine readiness...");

      try {
        const data = await requestIntelConnectivity();
        if (data?.connected) {
          setIntelConnected(true);
          setIntelConnectionMessage(
            typeof data?.message === "string" && data.message.trim()
              ? data.message
              : "KaaliX Intelligence engine connection established."
          );
          return;
        }

        const failureDetails =
          Array.isArray(data?.failureReasons) && data.failureReasons.length > 0
            ? ` (${data.failureReasons.join(", ")})`
            : "";
        setIntelConnected(false);
        setIntelConnectionMessage(
          `${data?.message || "Unable to connect KaaliX Intelligence engine."}${failureDetails}`
        );
      } catch (err) {
        setIntelConnected(false);
        setIntelConnectionMessage(getBackendErrorMessage(err));
      } finally {
        setIntelConnecting(false);
      }
    },
    [intelConnecting, requestIntelConnectivity]
  );

  const handleIntelApiKeySave = useCallback(async () => {
    const key = String(intelApiKeyInput || "").trim();
    if (key.length < 20) {
      setIntelApiKeyError("Enter a valid SerpAPI key.");
      return;
    }

    setIntelApiKeySaving(true);
    setIntelApiKeyError("");
    setIntelApiKeyMessage("");

    try {
      const data = await requestIntelSerpApiKeySave({ apiKey: key, clear: false });
      setIntelMaskedApiKey(typeof data?.maskedApiKey === "string" ? data.maskedApiKey : "");
      setIntelApiKeyInput("");
      setIntelApiKeyMessage(
        typeof data?.message === "string" && data.message.trim()
          ? data.message
          : "SerpAPI key saved successfully."
      );
      if (data?.connectivity) {
        applyConnectivitySnapshot(data.connectivity);
      }
    } catch (err) {
      setIntelApiKeyError(getBackendErrorMessage(err));
    } finally {
      setIntelApiKeySaving(false);
    }
  }, [applyConnectivitySnapshot, intelApiKeyInput, requestIntelSerpApiKeySave]);

  const handleIntelApiKeyClear = useCallback(async () => {
    setIntelApiKeySaving(true);
    setIntelApiKeyError("");
    setIntelApiKeyMessage("");

    try {
      const data = await requestIntelSerpApiKeySave({ clear: true });
      setIntelMaskedApiKey("");
      setIntelApiKeyInput("");
      setIntelApiKeyMessage(
        typeof data?.message === "string" && data.message.trim()
          ? data.message
          : "SerpAPI key removed."
      );
      if (data?.connectivity) {
        applyConnectivitySnapshot(data.connectivity);
      }
    } catch (err) {
      setIntelApiKeyError(getBackendErrorMessage(err));
    } finally {
      setIntelApiKeySaving(false);
    }
  }, [applyConnectivitySnapshot, requestIntelSerpApiKeySave]);

  const intelConnectionStateClass = intelConnecting ? "checking" : intelConnected ? "online" : "offline";
  const intelConnectionStateLabel = intelConnecting ? "Checking" : intelConnected ? "Online" : "Offline";

  const recentStats = useMemo(() => {
    const successCount = intelRecentSearches.filter((item) => item.status === "success").length;
    const failedCount = intelRecentSearches.filter((item) => item.status === "failed").length;
    return {
      successCount,
      failedCount,
      total: intelRecentSearches.length,
    };
  }, [intelRecentSearches]);

  return (
    <section className="dashboard-shell intel-settings-page">
      <header className="dashboard-shell-header intel-settings-header">
        <div>
          <h1>Kaalix Threat Intelligence</h1>
          <p>Central place for OSINT engine settings, API credentials, and recent investigation history.</p>
        </div>
        <Link className="intel-settings-dashboard-link" to="/dashboard">
          Go to Dashboard Search
        </Link>
      </header>

      <section className="intel-settings-stat-grid" aria-label="Threat intelligence status">
        <article className={`intel-settings-stat ${intelConnectionStateClass}`}>
          <h3>Engine Status</h3>
          <strong>{intelConnectionStateLabel}</strong>
          <p>{intelConnectionMessage}</p>
        </article>
        <article className="intel-settings-stat">
          <h3>API Key</h3>
          <strong>{intelMaskedApiKey ? "Configured" : "Missing"}</strong>
          <p>{intelMaskedApiKey || "No SerpAPI key configured."}</p>
        </article>
        <article className="intel-settings-stat">
          <h3>Recent Searches</h3>
          <strong>{recentStats.total}</strong>
          <p>{recentStats.successCount} successful / {recentStats.failedCount} failed</p>
        </article>
      </section>

      <section className="intel-settings-grid">
        <article className="intel-settings-card">
          <h2>Engine & API Configuration</h2>

          <div className="intel-settings-connect-row">
            <label className="intel-settings-connect-switch">
              <input
                type="checkbox"
                checked={intelConnected || intelConnecting}
                onChange={(event) => handleIntelConnectionToggle(event.target.checked)}
                disabled={intelConnecting}
                aria-label="Connect KaaliX Intelligence engine"
              />
              <span className="intel-settings-switch-track" aria-hidden="true">
                <span className="intel-settings-switch-thumb" />
              </span>
              <span className="intel-settings-connect-label">Connect Engine</span>
            </label>
            <span className={`intel-settings-connection-state ${intelConnectionStateClass}`}>
              {intelConnectionStateLabel}
            </span>
          </div>

          <div className="intel-settings-key-row">
            <input
              type="password"
              value={intelApiKeyInput}
              onChange={(event) => {
                setIntelApiKeyInput(event.target.value);
                if (intelApiKeyError) setIntelApiKeyError("");
              }}
              placeholder="Enter SerpAPI key (Super Admin)"
              aria-label="SerpAPI key"
              disabled={intelApiKeySaving}
            />
            <button
              type="button"
              onClick={handleIntelApiKeySave}
              disabled={intelApiKeySaving || !intelApiKeyInput.trim()}
            >
              {intelApiKeySaving ? "Saving..." : "Save Key"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={handleIntelApiKeyClear}
              disabled={intelApiKeySaving}
            >
              Clear Key
            </button>
          </div>

          {intelApiKeyError ? <p className="intel-settings-key-error">{intelApiKeyError}</p> : null}
          {!intelApiKeyError && intelApiKeyMessage ? (
            <p className="intel-settings-key-success">{intelApiKeyMessage}</p>
          ) : null}
        </article>

        <article className="intel-settings-card">
          <div className="intel-settings-history-head">
            <h2>Recent Search History</h2>
            <button
              type="button"
              onClick={loadIntelRecentSearches}
              disabled={intelRecentSearchesLoading}
            >
              {intelRecentSearchesLoading ? "Loading..." : "Refresh"}
            </button>
          </div>

          {intelRecentSearchesError ? (
            <p className="intel-settings-history-error">{intelRecentSearchesError}</p>
          ) : null}

          {!intelRecentSearchesError && !intelRecentSearchesLoading && intelRecentSearches.length === 0 ? (
            <p className="intel-settings-history-empty">No searches yet. Run a query from Dashboard OSINT.</p>
          ) : null}

          {intelRecentSearches.length > 0 && (
            <ul className="intel-settings-history-list">
              {intelRecentSearches.map((entry) => (
                <li key={entry.id}>
                  <div>
                    <strong title={entry.query}>{entry.query}</strong>
                    <span className={`status ${entry.status}`}>
                      {entry.status === "failed" ? "Failed" : "Success"}
                    </span>
                  </div>
                  <small>{formatRecentSearchTime(entry.occurredAt)}</small>
                </li>
              ))}
            </ul>
          )}
        </article>
      </section>
    </section>
  );
};

export default ThreatIntelSettings;
