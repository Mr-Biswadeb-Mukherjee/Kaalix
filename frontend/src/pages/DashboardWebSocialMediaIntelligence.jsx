import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "@amon/shared";
import "./Styles/Dashboard.css";
import { useToast } from "../Components/UI/Toast";
import { getBackendErrorMessage, parseApiResponse } from "../Utils/apiError";

const GRAPH_VIEW_WIDTH = 1400;
const GRAPH_VIEW_HEIGHT = 760;
const GRAPH_CENTER_X = GRAPH_VIEW_WIDTH / 2;
const GRAPH_CENTER_Y = GRAPH_VIEW_HEIGHT / 2;
const GRAPH_DEFAULT_PAN = { x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y };
const GRAPH_MIN_ZOOM = 0.35;
const GRAPH_MAX_ZOOM = 2.8;
const GRAPH_ZOOM_STEP = 0.2;
const INTERNET_CONNECTION_SESSION_KEY = "amon.dashboard.internetConnected";

const getStoredInternetConnection = () => {
  if (typeof window === "undefined") return false;
  return window.sessionStorage.getItem(INTERNET_CONNECTION_SESSION_KEY) === "true";
};

const setStoredInternetConnection = (connected) => {
  if (typeof window === "undefined") return;
  if (connected) {
    window.sessionStorage.setItem(INTERNET_CONNECTION_SESSION_KEY, "true");
    return;
  }
  window.sessionStorage.removeItem(INTERNET_CONNECTION_SESSION_KEY);
};

const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

const formatDateTime = (value) => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
};

const truncateLabel = (value, max = 22) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "unknown";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

const getNodeColor = (type) => {
  switch (String(type || "").toLowerCase()) {
    case "profile":
    case "username":
      return "#4f46e5";
    case "email":
      return "#0ea5e9";
    case "domain":
    case "website":
    case "subdomain":
      return "#16a34a";
    case "gravatar":
      return "#9333ea";
    case "individual":
      return "#d97706";
    default:
      return "#64748b";
  }
};

const resolveRootNodeId = (nodes) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return "";
  const userSeed = nodes.find((node) => node?.source === "user_input");
  if (userSeed?.id) return userSeed.id;
  const targetSeed = nodes.find((node) => typeof node?.id === "string" && node.id.startsWith("target:"));
  if (targetSeed?.id) return targetSeed.id;
  return String(nodes[0]?.id || "");
};

const buildNodeLayout = (nodes, edges) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const sanitizedNodes = nodes.filter((node) => typeof node?.id === "string" && node.id.trim());
  if (sanitizedNodes.length === 0) return [];

  const nodeById = new Map(sanitizedNodes.map((node) => [node.id, node]));
  const adjacency = new Map();
  for (const node of sanitizedNodes) adjacency.set(node.id, new Set());

  if (Array.isArray(edges)) {
    for (const edge of edges) {
      const from = String(edge?.from || "");
      const to = String(edge?.to || "");
      if (!from || !to || !adjacency.has(from) || !adjacency.has(to)) continue;
      adjacency.get(from).add(to);
      adjacency.get(to).add(from);
    }
  }

  const rootId = resolveRootNodeId(sanitizedNodes);
  const queue = rootId ? [rootId] : [];
  const levelById = new Map();
  if (rootId) levelById.set(rootId, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentLevel = levelById.get(current) || 0;
    const neighbors = adjacency.get(current) || new Set();
    for (const next of neighbors) {
      if (levelById.has(next)) continue;
      levelById.set(next, currentLevel + 1);
      queue.push(next);
    }
  }

  const disconnected = sanitizedNodes
    .map((node) => node.id)
    .filter((id) => !levelById.has(id))
    .sort((a, b) => a.localeCompare(b));
  const maxLevel = Math.max(0, ...Array.from(levelById.values()));
  disconnected.forEach((id, index) => {
    levelById.set(id, maxLevel + 1 + Math.floor(index / 12));
  });

  const idsByLevel = new Map();
  for (const [id, level] of levelById.entries()) {
    if (!idsByLevel.has(level)) idsByLevel.set(level, []);
    idsByLevel.get(level).push(id);
  }

  const positioned = [];
  const levels = Array.from(idsByLevel.keys()).sort((a, b) => a - b);
  for (const level of levels) {
    const levelIds = idsByLevel.get(level).sort((a, b) => a.localeCompare(b));
    if (level === 0 && levelIds.length > 0) {
      const rootNode = nodeById.get(levelIds[0]);
      if (rootNode) {
        positioned.push({ ...rootNode, x: 0, y: 0, radius: 26 });
      }
      continue;
    }

    const radius = 160 + level * 120;
    const count = levelIds.length;
    const angleStep = (2 * Math.PI) / Math.max(1, count);
    const angleOffset = level % 2 === 0 ? Math.PI / 8 : Math.PI / 4;

    levelIds.forEach((id, index) => {
      const angle = angleOffset + index * angleStep;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * (radius * 0.72);
      const node = nodeById.get(id);
      if (!node) return;
      positioned.push({
        ...node,
        x,
        y,
        radius: id === rootId ? 26 : 20,
      });
    });
  }

  return positioned;
};

const getStatusClass = (status) => {
  if (status === "ok") return "ok";
  if (status === "partial") return "partial";
  return "failed";
};

const getStatusLabel = (status) => {
  if (status === "ok") return "ok";
  if (status === "partial") return "partial";
  return "failed";
};

const DashboardWebSocialMediaIntelligence = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [query, setQuery] = useState("");
  const [isConnected, setIsConnected] = useState(getStoredInternetConnection);
  const [isSearching, setIsSearching] = useState(false);
  const [searchElapsedMs, setSearchElapsedMs] = useState(0);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");
  const [graphZoom, setGraphZoom] = useState(1);
  const [graphPan, setGraphPan] = useState(GRAPH_DEFAULT_PAN);
  const [isGraphPanning, setIsGraphPanning] = useState(false);
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const graphCanvasRef = useRef(null);
  const graphZoomRef = useRef(1);
  const graphPanRef = useRef(GRAPH_DEFAULT_PAN);
  const panPointerRef = useRef(null);
  const activePointersRef = useRef(new Map());
  const pinchStateRef = useRef({ distance: 0 });

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

  const requestIntelSearch = useCallback(async (nextQuery) => {
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
      body: JSON.stringify({ query: nextQuery }),
    });

    return parseApiResponse(response, { requireSuccess: true });
  }, []);

  useEffect(() => {
    let isCancelled = false;

    if (getStoredInternetConnection()) {
      setIsConnected(true);
      return () => {
        isCancelled = true;
      };
    }

    (async () => {
      try {
        const data = await requestIntelConnectivity();
        if (isCancelled) return;
        const connected = Boolean(data?.connected);
        setIsConnected(connected);
        setStoredInternetConnection(connected);
      } catch {
        if (isCancelled) return;
        setIsConnected(false);
        setStoredInternetConnection(false);
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [requestIntelConnectivity]);

  useEffect(() => {
    if (!isSearching) {
      setSearchElapsedMs(0);
      return;
    }

    const searchStartedAt = Date.now();
    const timer = setInterval(() => {
      setSearchElapsedMs(Date.now() - searchStartedAt);
    }, 100);

    return () => {
      clearInterval(timer);
    };
  }, [isSearching]);

  const handleSearchSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (isSearching) return;

      const normalizedQuery = String(query || "").trim();
      if (normalizedQuery.length < 2) {
        addToast("Enter at least 2 characters to search.", "warning");
        return;
      }

      setSearchError("");
      setSearchResult(null);
      setIsSearching(true);
      try {
        if (!isConnected) {
          const connectivity = await requestIntelConnectivity();
          if (!connectivity?.connected) {
            setIsConnected(false);
            setStoredInternetConnection(false);
            addToast("Connect to internet from Dashboard before searching.", "warning");
            return;
          }
          setIsConnected(true);
          setStoredInternetConnection(true);
        }

        const data = await requestIntelSearch(normalizedQuery);
        setSearchResult(data);
      } catch (err) {
        const errorMessage = getBackendErrorMessage(err);
        setSearchError(errorMessage);
        addToast(errorMessage, "error");
      } finally {
        setIsSearching(false);
      }
    },
    [addToast, isConnected, isSearching, query, requestIntelConnectivity, requestIntelSearch]
  );

  const graphNodes = useMemo(
    () => (Array.isArray(searchResult?.graph?.nodes) ? searchResult.graph.nodes : []),
    [searchResult]
  );
  const graphEdges = useMemo(
    () => (Array.isArray(searchResult?.graph?.edges) ? searchResult.graph.edges : []),
    [searchResult]
  );
  const sourceStatuses = useMemo(
    () => (Array.isArray(searchResult?.sources) ? searchResult.sources : []),
    [searchResult]
  );
  const timeline = useMemo(
    () => (Array.isArray(searchResult?.timeline) ? searchResult.timeline : []),
    [searchResult]
  );
  const pivotNodes = useMemo(() => buildNodeLayout(graphNodes, graphEdges), [graphNodes, graphEdges]);
  const pivotNodeById = useMemo(
    () => new Map(pivotNodes.map((node) => [node.id, node])),
    [pivotNodes]
  );
  const pivotEdges = useMemo(
    () =>
      graphEdges
        .map((edge, index) => {
          const fromNode = pivotNodeById.get(String(edge?.from || ""));
          const toNode = pivotNodeById.get(String(edge?.to || ""));
          if (!fromNode || !toNode) return null;
          return {
            ...edge,
            id: edge?.id || `${fromNode.id}|${toNode.id}|${edge?.relation || index}`,
            fromNode,
            toNode,
          };
        })
        .filter(Boolean),
    [graphEdges, pivotNodeById]
  );
  const selectedNode = useMemo(
    () => (selectedNodeId ? pivotNodes.find((node) => node.id === selectedNodeId) || null : null),
    [pivotNodes, selectedNodeId]
  );
  const selectedNodeRelations = useMemo(
    () =>
      pivotEdges.filter(
        (edge) => edge.fromNode?.id === selectedNodeId || edge.toNode?.id === selectedNodeId
      ),
    [pivotEdges, selectedNodeId]
  );
  const selectedNodeEvidence = useMemo(
    () => (Array.isArray(selectedNode?.evidence) ? selectedNode.evidence : []),
    [selectedNode]
  );
  const summary = searchResult?.summary || {};

  const resetGraphViewport = useCallback(() => {
    setGraphZoom(1);
    setGraphPan(GRAPH_DEFAULT_PAN);
  }, []);

  useEffect(() => {
    graphZoomRef.current = graphZoom;
  }, [graphZoom]);

  useEffect(() => {
    graphPanRef.current = graphPan;
  }, [graphPan]);

  const applyZoomAtViewportPoint = useCallback((requestedZoom, viewportX, viewportY) => {
    const currentZoom = graphZoomRef.current;
    const currentPan = graphPanRef.current;
    const nextZoom = clampNumber(requestedZoom, GRAPH_MIN_ZOOM, GRAPH_MAX_ZOOM);
    if (nextZoom === currentZoom) return;

    const worldX = (viewportX - currentPan.x) / currentZoom;
    const worldY = (viewportY - currentPan.y) / currentZoom;
    const nextPan = {
      x: viewportX - worldX * nextZoom,
      y: viewportY - worldY * nextZoom,
    };

    graphZoomRef.current = nextZoom;
    graphPanRef.current = nextPan;
    setGraphZoom(nextZoom);
    setGraphPan(nextPan);
  }, []);

  const zoomGraphIn = useCallback(() => {
    applyZoomAtViewportPoint(graphZoomRef.current + GRAPH_ZOOM_STEP, GRAPH_CENTER_X, GRAPH_CENTER_Y);
  }, [applyZoomAtViewportPoint]);

  const zoomGraphOut = useCallback(() => {
    applyZoomAtViewportPoint(graphZoomRef.current - GRAPH_ZOOM_STEP, GRAPH_CENTER_X, GRAPH_CENTER_Y);
  }, [applyZoomAtViewportPoint]);

  const centerGraphOnNode = useCallback(
    (nodeId) => {
      const node = pivotNodeById.get(nodeId);
      if (!node) return;
      setGraphPan({
        x: GRAPH_CENTER_X - node.x * graphZoom,
        y: GRAPH_CENTER_Y - node.y * graphZoom,
      });
    },
    [graphZoom, pivotNodeById]
  );

  const handleGraphWheel = useCallback(
    (event) => {
      event.preventDefault();
      if (!graphCanvasRef.current) return;

      const clientX = event.clientX;
      const clientY = event.clientY;
      const rect = graphCanvasRef.current.getBoundingClientRect();
      const viewportX = clientX - rect.left;
      const viewportY = clientY - rect.top;
      const zoomDelta = event.deltaY < 0 ? GRAPH_ZOOM_STEP : -GRAPH_ZOOM_STEP;
      applyZoomAtViewportPoint(graphZoomRef.current + zoomDelta, viewportX, viewportY);
    },
    [applyZoomAtViewportPoint]
  );

  const handleGraphPointerDown = useCallback((event) => {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (activePointersRef.current.size >= 2) {
      const [p1, p2] = Array.from(activePointersRef.current.values());
      pinchStateRef.current.distance = Math.hypot(p2.x - p1.x, p2.y - p1.y) || 1;
      panPointerRef.current = null;
      setIsGraphPanning(false);
    } else {
      panPointerRef.current = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
      setIsGraphPanning(true);
    }
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, []);

  const handleGraphPointerMove = useCallback(
    (event) => {
      if (activePointersRef.current.has(event.pointerId)) {
        activePointersRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (activePointersRef.current.size >= 2) {
        if (!graphCanvasRef.current) return;
        const [p1, p2] = Array.from(activePointersRef.current.values());
        const nextDistance = Math.hypot(p2.x - p1.x, p2.y - p1.y);
        const previousDistance = pinchStateRef.current.distance || nextDistance;
        const midpointClientX = (p1.x + p2.x) / 2;
        const midpointClientY = (p1.y + p2.y) / 2;
        const rect = graphCanvasRef.current.getBoundingClientRect();
        const viewportX = midpointClientX - rect.left;
        const viewportY = midpointClientY - rect.top;

        if (previousDistance > 0 && nextDistance > 0) {
          const scaleFactor = nextDistance / previousDistance;
          const requestedZoom = graphZoomRef.current * scaleFactor;
          applyZoomAtViewportPoint(requestedZoom, viewportX, viewportY);
        }

        pinchStateRef.current.distance = nextDistance || previousDistance;
        setIsGraphPanning(false);
        return;
      }

      if (!isGraphPanning || !panPointerRef.current) return;
      const dx = event.clientX - panPointerRef.current.x;
      const dy = event.clientY - panPointerRef.current.y;
      if (dx === 0 && dy === 0) return;
      setGraphPan((current) => ({ x: current.x + dx, y: current.y + dy }));
      graphPanRef.current = {
        x: graphPanRef.current.x + dx,
        y: graphPanRef.current.y + dy,
      };
      panPointerRef.current = { ...panPointerRef.current, x: event.clientX, y: event.clientY };
    },
    [applyZoomAtViewportPoint, isGraphPanning]
  );

  const handleGraphPointerUp = useCallback((event) => {
    activePointersRef.current.delete(event.pointerId);
    if (activePointersRef.current.size < 2) {
      pinchStateRef.current.distance = 0;
    }

    if (activePointersRef.current.size === 1) {
      const [remainingPointerId, remainingPoint] = Array.from(activePointersRef.current.entries())[0];
      panPointerRef.current = {
        x: remainingPoint.x,
        y: remainingPoint.y,
        pointerId: remainingPointerId,
      };
      setIsGraphPanning(true);
    }

    if (panPointerRef.current?.pointerId === event.pointerId) {
      panPointerRef.current = null;
    }
    if (activePointersRef.current.size === 0) {
      setIsGraphPanning(false);
    }
    try {
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    } catch {
      // noop: capture may have already been released on another target
    }
  }, []);

  useEffect(() => {
    if (pivotNodes.length === 0) {
      setSelectedNodeId("");
      return;
    }
    const rootId = resolveRootNodeId(pivotNodes);
    setSelectedNodeId(rootId || pivotNodes[0].id);
    resetGraphViewport();
  }, [pivotNodes, resetGraphViewport]);

  useEffect(
    () => () => {
      activePointersRef.current.clear();
      panPointerRef.current = null;
      pinchStateRef.current.distance = 0;
    },
    []
  );

  return (
    <section className="web-social-search-engine-page">
      <div className="web-social-top-left-back">
        <button
          type="button"
          className="web-social-back-button"
          onClick={() => navigate("/dashboard")}
          aria-label="Back to Dashboard"
        >
          <svg viewBox="0 0 24 24" focusable="false" aria-hidden="true">
            <path d="M14.7 5.3a1 1 0 0 1 0 1.4L10.42 11H20a1 1 0 1 1 0 2h-9.58l4.3 4.3a1 1 0 1 1-1.42 1.4l-6-6a1 1 0 0 1 0-1.4l6-6a1 1 0 0 1 1.4 0Z" />
          </svg>
        </button>
      </div>
      <div className="web-social-search-engine-shell">
        <h1 className="web-social-search-title">Web &amp; Social Media Intelligence</h1>

        <form className="web-social-search-form" role="search" onSubmit={handleSearchSubmit}>
          <div className="web-social-search-input-wrap">
            <span className="web-social-search-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" focusable="false">
                <path d="M15.5 14h-.79l-.28-.27A6.5 6.5 0 1 0 14 15.5l.27.28v.79L20 22l2-2-6.5-6Zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14Z" />
              </svg>
            </span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search web & social intelligence..."
              disabled={isSearching}
              aria-label="Search web and social intelligence"
            />
          </div>
        </form>
        {isSearching ? (
          <div className="web-social-search-status" role="status" aria-live="polite">
            <div className="web-social-search-status-row">
              <span className="web-social-search-status-text">Fetching results...</span>
              <strong>{(searchElapsedMs / 1000).toFixed(1)}s</strong>
            </div>
            <span className="web-social-search-status-track" aria-hidden="true">
              <span className="web-social-search-status-bar" />
            </span>
          </div>
        ) : null}

        {!isSearching && searchError ? (
          <p className="osint-search-error web-social-search-results">{searchError}</p>
        ) : null}

        {!isSearching && searchResult ? (
          <section className="osint-graph-result web-social-search-results" aria-live="polite">
            <header className="osint-graph-head">
              <div>
                <h4>Results for "{searchResult?.query || query.trim()}"</h4>
                <p>
                  Type: {searchResult?.queryType || "query"} | Generated:{" "}
                  {formatDateTime(searchResult?.generatedAt)}
                </p>
              </div>
              <div className="osint-graph-metrics">
                <span>{Number(summary?.nodes) || graphNodes.length} Nodes</span>
                <span>{Number(summary?.edges) || graphEdges.length} Edges</span>
                <span>{summary?.sourceHealth || `${sourceStatuses.length}/${sourceStatuses.length}`}</span>
              </div>
            </header>

            {sourceStatuses.length > 0 ? (
              <div className="osint-source-status-grid">
                {sourceStatuses.map((source, sourceIndex) => {
                  const statusClass = getStatusClass(source?.status);
                  return (
                    <article
                      key={source?.id || source?.label || `source-${sourceIndex}`}
                      className={`osint-source-chip ${statusClass}`}
                    >
                      <h5>{source?.label || "Collector"}</h5>
                      <p>
                        Status: {getStatusLabel(source?.status)} | Records: {Number(source?.records) || 0}
                      </p>
                      {source?.error ? <small>{source.error}</small> : null}
                    </article>
                  );
                })}
              </div>
            ) : null}

            {timeline.length > 0 ? (
              <section className="osint-build-timeline">
                <h5>Build Timeline</h5>
                <ul className="osint-build-timeline-list">
                  {timeline.map((entry) => {
                    const statusClass = getStatusClass(entry?.status);
                    return (
                      <li
                        key={entry?.id || `${entry?.label || "step"}-${entry?.completedAt || ""}`}
                        className={statusClass}
                      >
                        <div>
                          <strong>{entry?.label || "Collector step"}</strong>
                          <span>{getStatusLabel(entry?.status)}</span>
                        </div>
                        <p>{entry?.message || entry?.detail || "Completed."}</p>
                        <small>{formatDateTime(entry?.completedAt)}</small>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            <div className="osint-pivot-layout">
              <article className="osint-graph-panel osint-pivot-canvas-panel">
                <div className="osint-pivot-canvas-head">
                  <h5>Pivot Graph</h5>
                  <div className="osint-pivot-canvas-tools">
                    <div className="osint-graph-zoom-controls">
                      <button
                        type="button"
                        onClick={zoomGraphOut}
                        disabled={graphZoom <= GRAPH_MIN_ZOOM}
                        aria-label="Zoom out graph"
                      >
                        -
                      </button>
                      <span>{graphZoom.toFixed(2)}x</span>
                      <button
                        type="button"
                        onClick={zoomGraphIn}
                        disabled={graphZoom >= GRAPH_MAX_ZOOM}
                        aria-label="Zoom in graph"
                      >
                        +
                      </button>
                      <button type="button" className="secondary" onClick={resetGraphViewport}>
                        Reset
                      </button>
                    </div>
                  </div>
                </div>
                <p>
                  Drag to move the graph in any direction. Use scroll or +/- to zoom. Click a node to inspect
                  linked pivots.
                </p>
                <div className={`osint-pivot-canvas-wrap ${isGraphPanning ? "dragging" : ""}`} ref={graphCanvasRef}>
                  <svg
                    className="osint-pivot-svg"
                    viewBox={`0 0 ${GRAPH_VIEW_WIDTH} ${GRAPH_VIEW_HEIGHT}`}
                    role="img"
                    aria-label="Pivot graph visualization"
                    onWheel={handleGraphWheel}
                    onPointerMove={handleGraphPointerMove}
                    onPointerUp={handleGraphPointerUp}
                    onPointerLeave={handleGraphPointerUp}
                    onPointerCancel={handleGraphPointerUp}
                  >
                    <rect
                      className="osint-pivot-canvas-hitbox"
                      x="0"
                      y="0"
                      width={GRAPH_VIEW_WIDTH}
                      height={GRAPH_VIEW_HEIGHT}
                      onPointerDown={handleGraphPointerDown}
                    />
                    <g transform={`translate(${graphPan.x} ${graphPan.y}) scale(${graphZoom})`}>
                      {pivotEdges.map((edge) => {
                        const isActive =
                          selectedNodeId && (edge.fromNode.id === selectedNodeId || edge.toNode.id === selectedNodeId);
                        return (
                          <line
                            key={edge.id}
                            className={`osint-pivot-edge ${isActive ? "active" : ""}`}
                            x1={edge.fromNode.x}
                            y1={edge.fromNode.y}
                            x2={edge.toNode.x}
                            y2={edge.toNode.y}
                          />
                        );
                      })}

                      {pivotNodes.map((node) => {
                        const isSelected = node.id === selectedNodeId;
                        return (
                          <g
                            key={node.id}
                            className={`osint-pivot-node ${isSelected ? "selected" : ""}`}
                            transform={`translate(${node.x} ${node.y})`}
                            onClick={() => setSelectedNodeId(node.id)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") return;
                              event.preventDefault();
                              setSelectedNodeId(node.id);
                            }}
                          >
                            <circle
                              r={node.radius || 20}
                              fill={getNodeColor(node.type)}
                              stroke={isSelected ? "#f8fafc" : "rgba(248, 250, 252, 0.5)"}
                              strokeWidth={isSelected ? 2.6 : 1.4}
                            />
                            <text x="0" y={Number(node.radius || 20) + 16} textAnchor="middle">
                              {truncateLabel(node.label || node.id, 24)}
                            </text>
                          </g>
                        );
                      })}
                    </g>
                  </svg>
                </div>
              </article>

              <aside className="osint-graph-panel osint-pivot-inspector">
                {selectedNode ? (
                  <>
                    <div className="osint-pivot-selected">
                      <strong title={selectedNode.label || selectedNode.id}>
                        {selectedNode.label || selectedNode.id || "Selected node"}
                      </strong>
                      <small>
                        {selectedNode.type || "unknown"} | {selectedNode.source || "unknown source"}
                      </small>
                    </div>
                    <p className="osint-pivot-description">Node ID: {selectedNode.id}</p>
                    <p className="osint-pivot-meta">
                      Confidence:{" "}
                      {Number.isFinite(selectedNode.confidence)
                        ? `${Math.round(Number(selectedNode.confidence) * 100)}%`
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
                      <button type="button" onClick={() => centerGraphOnNode(selectedNode.id)}>
                        Center Node
                      </button>
                    </div>

                    <section>
                      <h5>Relations ({selectedNodeRelations.length})</h5>
                      {selectedNodeRelations.length === 0 ? (
                        <p className="web-social-search-empty">No relations for this node.</p>
                      ) : (
                        <ul className="osint-graph-list osint-pivot-relation-list">
                          {selectedNodeRelations.slice(0, 24).map((edge) => {
                            const counterpartId =
                              edge.fromNode.id === selectedNode.id ? edge.toNode.id : edge.fromNode.id;
                            const counterpart = pivotNodeById.get(counterpartId);
                            return (
                              <li key={`${selectedNode.id}|${edge.id}`}>
                                <div className="osint-edge-line">
                                  <span>{truncateLabel(counterpart?.label || counterpartId, 20)}</span>
                                  <strong>{edge?.relation || "linked_to"}</strong>
                                </div>
                                <p>Source: {edge?.source || "unknown"}</p>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </section>

                    <section>
                      <h5>Evidence ({selectedNodeEvidence.length})</h5>
                      {selectedNodeEvidence.length === 0 ? (
                        <p className="web-social-search-empty">No evidence attached.</p>
                      ) : (
                        <ul className="osint-graph-list osint-node-evidence-list">
                          {selectedNodeEvidence.slice(0, 24).map((entry, index) => (
                            <li key={`${selectedNode.id}-evidence-${index}`}>
                              <div>
                                <span>{entry?.label || "Collector evidence"}</span>
                                <small>{entry?.source || "unknown"}</small>
                              </div>
                              {entry?.url ? (
                                <a href={entry.url} target="_blank" rel="noreferrer">
                                  Open
                                </a>
                              ) : null}
                            </li>
                          ))}
                        </ul>
                      )}
                    </section>
                  </>
                ) : (
                  <p>Select a node in the graph to inspect pivot details.</p>
                )}
              </aside>
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
};

export default DashboardWebSocialMediaIntelligence;
