import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import API from "@amon/shared";
import "./Styles/Dashboard.css";
import { getBackendErrorMessage, parseApiResponse } from "../Utils/apiError";

const RELATION_LABELS = Object.freeze({
  matched_entity: "Matched Entity",
  official_website: "Official Website",
  knowledge_reference: "Knowledge Reference",
  public_code_identity: "Public Code Identity",
  input_domain: "Input Domain",
  input_website: "Input Website",
  username_candidate: "Username Candidate",
  website_username: "Website Username",
  website_person_name: "Website Person Name",
  website_contact_email: "Website Contact Email",
  website_link: "Website Link",
  certificate_observed: "Certificate Observed",
  dns_a_record: "DNS A Record",
  dns_aaaa_record: "DNS AAAA Record",
  dns_mx_record: "DNS MX Record",
  dns_ns_record: "DNS NS Record",
  dns_txt_record: "DNS TXT Record",
  domain_registrar: "Domain Registrar",
  rdap_nameserver: "RDAP Nameserver",
  rdap_status: "RDAP Status",
  x_account: "X Account",
  instagram_account: "Instagram Account",
  facebook_account: "Facebook Account",
  github_account: "GitHub Account",
  linkedin_account: "LinkedIn Account",
  youtube_channel: "YouTube Channel",
  reddit_account: "Reddit Account",
  hackernews_account: "Hacker News Account",
  keybase_account: "Keybase Account",
  input_email: "Input Email",
  email_domain: "Email Domain",
  related_email: "Related Email",
  email_candidate: "Email Candidate",
  profile_email: "Profile Email",
  related_website: "Related Website",
  profile_website: "Profile Website",
  profile_real_name: "Profile Real Name",
  website_domain: "Website Domain",
  gravatar_profile: "Gravatar Profile",
  gravatar_website: "Gravatar Website",
});

const NODE_THEME_BY_TYPE = Object.freeze({
  individual: { color: "#f97316", radius: 10 },
  company: { color: "#0ea5e9", radius: 10 },
  username: { color: "#d946ef", radius: 9 },
  entity: { color: "#1d4ed8", radius: 9 },
  domain: { color: "#0f766e", radius: 8 },
  subdomain: { color: "#14b8a6", radius: 7 },
  ip: { color: "#15803d", radius: 7 },
  nameserver: { color: "#0d9488", radius: 7 },
  mx_host: { color: "#0891b2", radius: 7 },
  registrar: { color: "#b45309", radius: 8 },
  rdap_status: { color: "#64748b", radius: 6 },
  dns_txt: { color: "#475569", radius: 6 },
  profile: { color: "#7c3aed", radius: 8 },
  email: { color: "#db2777", radius: 8 },
  website: { color: "#0369a1", radius: 8 },
  gravatar: { color: "#9333ea", radius: 8 },
  knowledge_article: { color: "#475569", radius: 7 },
  unknown: { color: "#64748b", radius: 8 },
});

const INTEL_BUILD_PHASES = Object.freeze([
  "Seed normalization and candidate expansion",
  "Probing identity platforms and profile metadata",
  "Correlating entities with public knowledge sources",
  "Expanding domain infrastructure and registration intel",
  "Linking email and Gravatar evidence",
]);

const GRAPH_WIDTH = 1480;
const GRAPH_HEIGHT = 760;
const GRAPH_CENTER_X = Math.round(GRAPH_WIDTH / 2);
const GRAPH_CENTER_Y = Math.round(GRAPH_HEIGHT / 2);
const MAX_VISIBLE_NODES = 48;
const MIN_GRAPH_ZOOM = 0.6;
const MAX_GRAPH_ZOOM = 2.6;
const GRAPH_ZOOM_STEP = 0.2;

const formatRelation = (relation = "") => {
  const normalized = String(relation || "").trim();
  if (!normalized) return "Related";
  if (RELATION_LABELS[normalized]) return RELATION_LABELS[normalized];
  return normalized.replaceAll("_", " ");
};

const formatNodeType = (type = "") =>
  String(type || "")
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) => char.toUpperCase())
    .trim() || "Node";

const truncateText = (text = "", maxLen = 120) => {
  const value = String(text || "").trim();
  if (!value || value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
};

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const hashString = (value = "") => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = ((hash << 5) - hash + value.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const getNodeTheme = (type = "") => NODE_THEME_BY_TYPE[type] || NODE_THEME_BY_TYPE.unknown;

const getRootNodeId = (nodes = []) => {
  const explicitTarget = nodes.find((node) => String(node?.id || "").startsWith("target:"));
  if (explicitTarget?.id) return explicitTarget.id;
  const explicitRoot = nodes.find((node) => node?.source === "user_input");
  if (explicitRoot?.id) return explicitRoot.id;
  return nodes[0]?.id || "";
};

const buildPivotLayout = (nodes = [], edges = [], selectedNodeId = "") => {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    return { nodes: [], edges: [], rootNodeId: "" };
  }

  const nodeMap = new Map();
  for (const node of nodes) {
    if (node?.id) {
      nodeMap.set(node.id, node);
    }
  }

  const rootNodeId = getRootNodeId(nodes);

  const degreeMap = new Map();
  for (const edge of edges) {
    if (!edge?.from || !edge?.to) continue;
    degreeMap.set(edge.from, (degreeMap.get(edge.from) || 0) + 1);
    degreeMap.set(edge.to, (degreeMap.get(edge.to) || 0) + 1);
  }

  const sortedNodeIds = Array.from(nodeMap.keys()).sort((a, b) => {
    if (a === rootNodeId) return -1;
    if (b === rootNodeId) return 1;
    if (a === selectedNodeId) return -1;
    if (b === selectedNodeId) return 1;
    const degreeDiff = (degreeMap.get(b) || 0) - (degreeMap.get(a) || 0);
    if (degreeDiff !== 0) return degreeDiff;
    return String(nodeMap.get(a)?.label || a).localeCompare(String(nodeMap.get(b)?.label || b));
  });

  const visibleNodeIds = new Set(sortedNodeIds.slice(0, MAX_VISIBLE_NODES));
  if (rootNodeId) visibleNodeIds.add(rootNodeId);
  if (selectedNodeId) visibleNodeIds.add(selectedNodeId);

  const visibleEdges = edges.filter(
    (edge) =>
      edge?.from &&
      edge?.to &&
      visibleNodeIds.has(edge.from) &&
      visibleNodeIds.has(edge.to) &&
      nodeMap.has(edge.from) &&
      nodeMap.has(edge.to)
  );

  const adjacency = new Map();
  const pushNeighbor = (from, to) => {
    if (!adjacency.has(from)) adjacency.set(from, []);
    adjacency.get(from).push(to);
  };

  for (const edge of visibleEdges) {
    pushNeighbor(edge.from, edge.to);
    pushNeighbor(edge.to, edge.from);
  }

  const levels = new Map();
  const queue = [];
  const startId = visibleNodeIds.has(rootNodeId) ? rootNodeId : sortedNodeIds[0];

  if (startId) {
    levels.set(startId, 0);
    queue.push(startId);
  }

  while (queue.length > 0) {
    const currentId = queue.shift();
    const currentLevel = levels.get(currentId) || 0;
    for (const neighborId of adjacency.get(currentId) || []) {
      if (levels.has(neighborId)) continue;
      levels.set(neighborId, currentLevel + 1);
      queue.push(neighborId);
    }
  }

  let maxAssignedLevel = Array.from(levels.values()).reduce((max, level) => Math.max(max, level), 0);
  for (const nodeId of visibleNodeIds) {
    if (levels.has(nodeId)) continue;
    maxAssignedLevel += 1;
    levels.set(nodeId, maxAssignedLevel);
  }

  const nodesByLevel = new Map();
  for (const nodeId of visibleNodeIds) {
    const level = levels.get(nodeId) || 0;
    if (!nodesByLevel.has(level)) nodesByLevel.set(level, []);
    nodesByLevel.get(level).push(nodeId);
  }

  for (const [, ids] of nodesByLevel) {
    ids.sort((a, b) => {
      if (a === rootNodeId) return -1;
      if (b === rootNodeId) return 1;
      return String(nodeMap.get(a)?.label || a).localeCompare(String(nodeMap.get(b)?.label || b));
    });
  }

  const maxLevel = Math.max(1, ...nodesByLevel.keys());
  const maxGraphRadius = Math.min(GRAPH_WIDTH, GRAPH_HEIGHT) * 0.45;
  const levelStep = maxGraphRadius / maxLevel;
  const positions = new Map();

  for (const [level, ids] of nodesByLevel) {
    if (level === 0 && ids.length > 0) {
      positions.set(ids[0], { x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y });
      continue;
    }

    const ringRadius = Math.max(78, level * levelStep);
    const angleStep = (Math.PI * 2) / Math.max(1, ids.length);
    const startAngle = level * 0.53;

    ids.forEach((nodeId, index) => {
      const hash = hashString(nodeId);
      const wobble = (hash % 13) - 6;
      const radius = ringRadius + wobble;
      const angle = startAngle + index * angleStep;
      const x = clamp(
        Math.round(GRAPH_CENTER_X + Math.cos(angle) * radius),
        36,
        GRAPH_WIDTH - 36
      );
      const y = clamp(
        Math.round(GRAPH_CENTER_Y + Math.sin(angle) * radius),
        36,
        GRAPH_HEIGHT - 36
      );
      positions.set(nodeId, { x, y });
    });
  }

  const layoutNodes = Array.from(visibleNodeIds).map((nodeId) => {
    const node = nodeMap.get(nodeId);
    const position = positions.get(nodeId) || { x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y };
    const theme = getNodeTheme(node?.type);
    return {
      ...node,
      x: position.x,
      y: position.y,
      degree: degreeMap.get(nodeId) || 0,
      isRoot: nodeId === rootNodeId,
      isSelected: nodeId === selectedNodeId,
      color: theme.color,
      radius: nodeId === rootNodeId ? 12 : theme.radius,
    };
  });

  const layoutNodeMap = new Map(layoutNodes.map((node) => [node.id, node]));
  const layoutEdges = visibleEdges.map((edge) => {
    const from = layoutNodeMap.get(edge.from);
    const to = layoutNodeMap.get(edge.to);
    return {
      ...edge,
      x1: from?.x || 0,
      y1: from?.y || 0,
      x2: to?.x || 0,
      y2: to?.y || 0,
      connectedToSelection:
        edge.from === selectedNodeId ||
        edge.to === selectedNodeId ||
        edge.from === rootNodeId ||
        edge.to === rootNodeId,
    };
  });

  return {
    rootNodeId,
    nodes: layoutNodes,
    edges: layoutEdges,
  };
};

const Dashboard = () => {
  const [intelQuery, setIntelQuery] = useState("");
  const [intelConnected, setIntelConnected] = useState(false);
  const [intelConnecting, setIntelConnecting] = useState(false);
  const [intelSearching, setIntelSearching] = useState(false);
  const [intelSearchError, setIntelSearchError] = useState("");
  const [intelGraph, setIntelGraph] = useState(null);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [pivotTrail, setPivotTrail] = useState([]);
  const [intelBuildPhaseIndex, setIntelBuildPhaseIndex] = useState(0);
  const [intelConnectionMessage, setIntelConnectionMessage] = useState(
    "KaaliX Intelligence is offline. Connect engine to enable search."
  );
  const [intelGraphZoom, setIntelGraphZoom] = useState(1);

  useEffect(() => {
    if (!intelSearching) {
      setIntelBuildPhaseIndex(0);
      return undefined;
    }

    const timer = setInterval(() => {
      setIntelBuildPhaseIndex((prev) => (prev + 1) % INTEL_BUILD_PHASES.length);
    }, 1300);

    return () => clearInterval(timer);
  }, [intelSearching]);

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

  const requestIntelGraph = useCallback(async (query) => {
    const token = localStorage.getItem("token");
    if (!token) {
      throw new Error("Missing session token. Please log in again.");
    }

    const response = await fetch(API.system.protected.intelSearch.endpoint, {
      method: API.system.protected.intelSearch.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    return parseApiResponse(response, { requireSuccess: true });
  }, []);

  const executeIntelSearch = useCallback(
    async (rawQuery, options = {}) => {
      if (!intelConnected || intelConnecting || intelSearching) return;

      const query = String(rawQuery || "").trim();
      if (query.length < 2) {
        setIntelSearchError("Enter at least 2 characters to build an intelligence graph.");
        return;
      }

      setIntelSearching(true);
      setIntelBuildPhaseIndex(0);
      setIntelSearchError("");
      setIntelQuery(query);
      setIntelConnectionMessage(
        options.isPivot
          ? `Pivoting graph from "${query}" through KaaliX engine...`
          : "Dispatching query to KaaliX engine and building graph..."
      );

      try {
        const data = await requestIntelGraph(query);
        const graphNodes = Array.isArray(data?.graph?.nodes) ? data.graph.nodes : [];
        const nextRootId = getRootNodeId(graphNodes);

        setIntelGraph(data);
        setIntelGraphZoom(1);
        setSelectedNodeId(nextRootId);
        setPivotTrail((prev) => {
          const next = prev.filter(Boolean);
          if (next[next.length - 1] === query) return next;
          return [...next.slice(-5), query];
        });
        setIntelConnectionMessage(
          typeof data?.message === "string" && data.message.trim()
            ? data.message
            : "KaaliX Intelligence graph updated."
        );
      } catch (err) {
        setIntelSearchError(getBackendErrorMessage(err));
        setIntelConnectionMessage("KaaliX Intelligence graph request failed.");
      } finally {
        setIntelSearching(false);
      }
    },
    [intelConnected, intelConnecting, intelSearching, requestIntelGraph]
  );

  const handleIntelConnectionToggle = useCallback(
    async (nextChecked) => {
      if (intelConnecting) return;

      if (!nextChecked) {
        setIntelConnected(false);
        setIntelConnectionMessage("KaaliX Intelligence is offline.");
        setIntelSearchError("");
        setIntelGraph(null);
        setIntelSearching(false);
        setSelectedNodeId("");
        setPivotTrail([]);
        setIntelGraphZoom(1);
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

  const handleIntelSearchSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      await executeIntelSearch(intelQuery, { isPivot: false });
    },
    [executeIntelSearch, intelQuery]
  );

  const intelNodes = useMemo(() => {
    const rows = Array.isArray(intelGraph?.graph?.nodes) ? intelGraph.graph.nodes : [];
    return [...rows].sort((a, b) => String(a?.label || "").localeCompare(String(b?.label || "")));
  }, [intelGraph]);

  const intelEdges = useMemo(() => {
    const rows = Array.isArray(intelGraph?.graph?.edges) ? intelGraph.graph.edges : [];
    return [...rows].sort((a, b) =>
      String(a?.relation || "").localeCompare(String(b?.relation || ""))
    );
  }, [intelGraph]);

  const nodeLabelMap = useMemo(() => {
    const map = new Map();
    for (const node of intelNodes) {
      map.set(node.id, node.label || node.id);
    }
    return map;
  }, [intelNodes]);

  const selectedNode = useMemo(
    () => intelNodes.find((node) => node.id === selectedNodeId) || null,
    [intelNodes, selectedNodeId]
  );

  const selectedNodeEdges = useMemo(
    () =>
      selectedNodeId
        ? intelEdges.filter((edge) => edge.from === selectedNodeId || edge.to === selectedNodeId)
        : [],
    [intelEdges, selectedNodeId]
  );

  const selectedNodeEvidence = useMemo(() => {
    const rows = Array.isArray(selectedNode?.evidence) ? selectedNode.evidence : [];
    return rows
      .filter((entry) => entry && (entry.url || entry.source))
      .slice(0, 8);
  }, [selectedNode]);

  const buildTimeline = useMemo(() => {
    const rows = Array.isArray(intelGraph?.timeline) ? intelGraph.timeline : [];
    return [...rows];
  }, [intelGraph]);

  const pivotLayout = useMemo(
    () => buildPivotLayout(intelNodes, intelEdges, selectedNodeId),
    [intelEdges, intelNodes, selectedNodeId]
  );

  const handlePivotFromNode = useCallback(
    async (node) => {
      const pivotQuery = String(node?.handle || node?.label || "").trim();
      if (!pivotQuery) return;
      await executeIntelSearch(pivotQuery, { isPivot: true });
    },
    [executeIntelSearch]
  );

  const handlePivotSelectedNode = useCallback(async () => {
    if (!selectedNode) return;
    await handlePivotFromNode(selectedNode);
  }, [handlePivotFromNode, selectedNode]);

  const intelConnectionStateClass = intelConnecting ? "checking" : intelConnected ? "online" : "offline";
  const intelConnectionStateLabel = intelConnecting ? "Checking" : intelConnected ? "Online" : "Offline";
  const intelNodeCount = intelGraph?.summary?.nodes ?? intelNodes.length;
  const intelEdgeCount = intelGraph?.summary?.edges ?? intelEdges.length;
  const intelSourceHealth = intelGraph?.summary?.sourceHealth || "0/0";

  const handleIntelGraphZoomIn = useCallback(() => {
    setIntelGraphZoom((prev) =>
      clamp(Number(prev) + GRAPH_ZOOM_STEP, MIN_GRAPH_ZOOM, MAX_GRAPH_ZOOM)
    );
  }, []);

  const handleIntelGraphZoomOut = useCallback(() => {
    setIntelGraphZoom((prev) =>
      clamp(Number(prev) - GRAPH_ZOOM_STEP, MIN_GRAPH_ZOOM, MAX_GRAPH_ZOOM)
    );
  }, []);

  const handleIntelGraphZoomReset = useCallback(() => {
    setIntelGraphZoom(1);
  }, []);

  const handleIntelGraphWheelZoom = useCallback((event) => {
    event.preventDefault();
    const direction = event.deltaY < 0 ? 1 : -1;
    setIntelGraphZoom((prev) =>
      clamp(Number(prev) + direction * GRAPH_ZOOM_STEP, MIN_GRAPH_ZOOM, MAX_GRAPH_ZOOM)
    );
  }, []);

  return (
    <section className="dashboard-shell dashboard-page">
      <header className="dashboard-shell-header dashboard-header">
        <div className="dashboard-header-copy">
          <h1>Security Dashboard</h1>
          <p>OSINT intelligence workspace for reconnaissance and graph pivots.</p>
        </div>
      </header>

      <section className="dashboard-mode-panel osint-mode-centered">
        <article className="osint-intel-shell">
            <header className="osint-shell-head">
              <div className="osint-shell-copy">
                <p className="osint-shell-eyebrow">Threat Intelligence Console</p>
                <h3 className="osint-intel-title">
                  <span className="osint-title-icon" aria-hidden="true">
                    INT
                  </span>
                  <span>KaaliX OSINT Command Center</span>
                </h3>
                <p className="osint-shell-description">
                  Search-first workspace for reconnaissance and graph pivots. Configure endpoints, API keys, and
                  search history from the dedicated settings page.
                </p>
                <p className="osint-shell-actions">
                  <Link to="/threat-intel">Open Threat Intelligence Settings</Link>
                </p>
              </div>
            </header>
            <section className="osint-search-focus-shell">
              <div className="osint-search-focus-kpis">
                <article className={`osint-kpi-card ${intelConnectionStateClass}`}>
                  <p>Engine Status</p>
                  <strong>{intelConnectionStateLabel}</strong>
                  <span>{intelConnecting ? "Readiness check in progress" : "Secure channel control"}</span>
                </article>
                <article className="osint-kpi-card">
                  <p>Graph Snapshot</p>
                  <strong>
                    {intelNodeCount}N / {intelEdgeCount}E
                  </strong>
                  <span>Source health {intelSourceHealth}</span>
                </article>
              </div>
              <div className="osint-search-center">
                <div className="osint-connect-row centered">
                  <label className="osint-connect-switch">
                    <input
                      type="checkbox"
                      checked={intelConnected || intelConnecting}
                      onChange={(event) => handleIntelConnectionToggle(event.target.checked)}
                      disabled={intelConnecting}
                      aria-label="Connect KaaliX Intelligence engine"
                    />
                    <span className="osint-switch-track" aria-hidden="true">
                      <span className="osint-switch-thumb" />
                    </span>
                    <span className="osint-connect-label">Connect Engine</span>
                  </label>
                  <span className={`osint-connection-state ${intelConnectionStateClass}`}>
                    {intelConnectionStateLabel}
                  </span>
                </div>
                <form
                  className={`osint-intel-form osint-intel-form-centered ${
                    intelConnected && !intelConnecting ? "enabled" : "disabled"
                  }`}
                  role="search"
                  onSubmit={handleIntelSearchSubmit}
                >
                  <span className="osint-input-icon" aria-hidden="true">
                    Q
                  </span>
                  <input
                    type="search"
                    value={intelQuery}
                    onChange={(event) => {
                      setIntelQuery(event.target.value);
                      if (intelSearchError) setIntelSearchError("");
                    }}
                    placeholder={
                      intelConnecting
                        ? "Checking engine readiness..."
                        : intelConnected
                        ? "Enter query to build graph via KaaliX engine"
                        : "Connect engine to enable KaaliX Intelligence search"
                    }
                    aria-label="Search KaaliX Intelligence"
                    disabled={!intelConnected || intelConnecting || intelSearching}
                  />
                  <button
                    type="submit"
                    className="osint-search-submit"
                    disabled={!intelConnected || intelConnecting || intelSearching}
                  >
                    {intelSearching ? "Mapping..." : "Build Graph"}
                  </button>
                </form>
                <p className={`osint-connection-message ${intelConnectionStateClass}`}>
                  {intelConnectionMessage}
                </p>
              </div>
            </section>

            {intelSearchError && <p className="osint-search-error">{intelSearchError}</p>}
            {!intelSearchError && intelSearching && (
              <div className="osint-search-loading">
                <p>Collecting KaaliX engine outputs and building intelligence graph...</p>
                <ol className="osint-build-phase-list">
                  {INTEL_BUILD_PHASES.map((phase, index) => (
                    <li
                      key={phase}
                      className={index <= intelBuildPhaseIndex ? "active" : ""}
                    >
                      {phase}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {!intelSearching && intelGraph && (
              <article className="osint-graph-result">
                <header className="osint-graph-head">
                  <div>
                    <h4>Live Public-Data Graph</h4>
                    <p>
                      Target: <strong>{intelGraph?.query || intelQuery.trim()}</strong> (
                      {formatNodeType(intelGraph?.queryType || "unknown")})
                    </p>
                  </div>
                  <div className="osint-graph-metrics">
                    <span>Nodes {intelGraph?.summary?.nodes ?? intelNodes.length}</span>
                    <span>Edges {intelGraph?.summary?.edges ?? intelEdges.length}</span>
                    <span>Emails {intelGraph?.summary?.emails ?? 0}</span>
                    <span>Sources {intelGraph?.summary?.sourceHealth || "0/0"}</span>
                  </div>
                </header>

                <section className="osint-source-status-grid" aria-label="Public source status">
                  {(Array.isArray(intelGraph?.sources) ? intelGraph.sources : []).map((source) => (
                    <article className={`osint-source-chip ${source?.status || "unknown"}`} key={source.id}>
                      <h5>{source.label}</h5>
                      <p>
                        {source.status} · {source.records} records
                      </p>
                      {source.error ? <small>{truncateText(source.error, 96)}</small> : null}
                      {source?.url ? (
                        <a href={source.url} target="_blank" rel="noreferrer">
                          Visit source
                        </a>
                      ) : null}
                    </article>
                  ))}
                </section>
                {buildTimeline.length > 0 && (
                  <section className="osint-build-timeline" aria-label="Graph build timeline">
                    <h5>Graph Build Timeline</h5>
                    <ul className="osint-build-timeline-list">
                      {buildTimeline.map((step) => (
                        <li key={`${step.id}-${step.completedAt}`} className={step.status || "unknown"}>
                          <div>
                            <strong>{step.label}</strong>
                            <span>
                              {step.status} · {step.records} records · {step.durationMs}ms
                            </span>
                          </div>
                          {step.detail ? <p>{step.detail}</p> : null}
                          {step.message ? <small>{step.message}</small> : null}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}

                <section className="osint-pivot-layout">
                  <div className="osint-graph-panel osint-pivot-canvas-panel">
                    <div className="osint-pivot-canvas-head">
                      <h5>Pivot Graph Model</h5>
                      <div className="osint-pivot-canvas-tools">
                        <p>Click node to inspect. Double-click node to pivot.</p>
                        <div className="osint-graph-zoom-controls" role="group" aria-label="Graph zoom controls">
                          <button
                            type="button"
                            onClick={handleIntelGraphZoomOut}
                            disabled={intelGraphZoom <= MIN_GRAPH_ZOOM}
                            aria-label="Zoom out graph"
                          >
                            -
                          </button>
                          <span>{Math.round(intelGraphZoom * 100)}%</span>
                          <button
                            type="button"
                            onClick={handleIntelGraphZoomIn}
                            disabled={intelGraphZoom >= MAX_GRAPH_ZOOM}
                            aria-label="Zoom in graph"
                          >
                            +
                          </button>
                          <button
                            type="button"
                            className="secondary"
                            onClick={handleIntelGraphZoomReset}
                            disabled={intelGraphZoom === 1}
                          >
                            Reset
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="osint-pivot-canvas-wrap" onWheel={handleIntelGraphWheelZoom}>
                      <svg
                        className="osint-pivot-svg"
                        viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`}
                        role="img"
                        aria-label="KaaliX pivot graph"
                      >
                        <g
                          transform={`translate(${GRAPH_CENTER_X} ${GRAPH_CENTER_Y}) scale(${intelGraphZoom}) translate(${-GRAPH_CENTER_X} ${-GRAPH_CENTER_Y})`}
                        >
                          <g className="osint-pivot-edges">
                            {pivotLayout.edges.map((edge) => (
                              <line
                                key={edge.id}
                                x1={edge.x1}
                                y1={edge.y1}
                                x2={edge.x2}
                                y2={edge.y2}
                                className={`osint-pivot-edge ${edge.connectedToSelection ? "active" : ""}`}
                              />
                            ))}
                          </g>
                          <g className="osint-pivot-nodes">
                            {pivotLayout.nodes.map((node) => (
                              <g
                                key={node.id}
                                className={`osint-pivot-node ${node.isSelected ? "selected" : ""}`}
                                transform={`translate(${node.x}, ${node.y})`}
                                onClick={() => setSelectedNodeId(node.id)}
                                onDoubleClick={() => handlePivotFromNode(node)}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter" || event.key === " ") {
                                    event.preventDefault();
                                    setSelectedNodeId(node.id);
                                  }
                                }}
                              >
                                <circle
                                  r={node.radius}
                                  fill={node.color}
                                  stroke={node.isSelected ? "#f8fafc" : "rgba(248, 250, 252, 0.46)"}
                                  strokeWidth={node.isSelected ? 2.3 : 1.1}
                                />
                                <text x={node.radius + 4} y={4}>
                                  {truncateText(node.label || node.id, 23)}
                                </text>
                              </g>
                            ))}
                          </g>
                        </g>
                      </svg>
                    </div>
                  </div>

                  <aside className="osint-graph-panel osint-pivot-inspector">
                    <h5>Node Inspector</h5>
                    {!selectedNode && <p>Select a node from the graph.</p>}
                    {selectedNode && (
                      <>
                        <div className="osint-pivot-selected">
                          <strong>{selectedNode.label || selectedNode.id}</strong>
                          <small>{formatNodeType(selectedNode.type)}</small>
                        </div>
                        {selectedNode.description ? (
                          <p className="osint-pivot-description">
                            {truncateText(selectedNode.description, 180)}
                          </p>
                        ) : null}
                        <p className="osint-pivot-meta">
                          Source: {selectedNode.source || "public-data"} · Linked edges:{" "}
                          {selectedNodeEdges.length} · Confidence:{" "}
                          {typeof selectedNode.confidence === "number"
                            ? `${Math.round(selectedNode.confidence * 100)}%`
                            : "n/a"}
                        </p>
                        <div className="osint-pivot-actions">
                          {selectedNode.url ? (
                            <a href={selectedNode.url} target="_blank" rel="noreferrer">
                              Open Source
                            </a>
                          ) : (
                            <span />
                          )}
                          <button
                            type="button"
                            onClick={handlePivotSelectedNode}
                            disabled={intelSearching || !selectedNode.label}
                          >
                            Pivot From Node
                          </button>
                        </div>
                        {selectedNodeEvidence.length > 0 && (
                          <ul className="osint-graph-list osint-node-evidence-list">
                            {selectedNodeEvidence.map((evidence, index) => (
                              <li key={`${evidence.source || "evidence"}-${index}`}>
                                <div>
                                  <span>{evidence.label || evidence.source || "Evidence"}</span>
                                </div>
                                <p>Source: {evidence.source || "public-data"}</p>
                                {evidence.url ? (
                                  <a href={evidence.url} target="_blank" rel="noreferrer">
                                    Open evidence link
                                  </a>
                                ) : null}
                              </li>
                            ))}
                          </ul>
                        )}
                        <ul className="osint-graph-list osint-pivot-relation-list">
                          {selectedNodeEdges.length === 0 && <li>No relations for selected node.</li>}
                          {selectedNodeEdges.slice(0, 10).map((edge) => (
                            <li key={edge.id}>
                              <div className="osint-edge-line">
                                <span>{nodeLabelMap.get(edge.from) || edge.from}</span>
                                <strong>{formatRelation(edge.relation)}</strong>
                                <span>{nodeLabelMap.get(edge.to) || edge.to}</span>
                              </div>
                              <p>
                                Source: {edge.source || "public-data"} · Confidence:{" "}
                                {typeof edge.confidence === "number"
                                  ? `${Math.round(edge.confidence * 100)}%`
                                  : "n/a"}
                              </p>
                              {edge.sourceUrl ? (
                                <a href={edge.sourceUrl} target="_blank" rel="noreferrer">
                                  Open relation source
                                </a>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      </>
                    )}
                    {pivotTrail.length > 0 && (
                      <p className="osint-pivot-trail">Pivot Trail: {pivotTrail.join(" → ")}</p>
                    )}
                  </aside>
                </section>
              </article>
            )}
          </article>
      </section>
    </section>
  );
};

export default Dashboard;
