import { useCallback, useEffect, useMemo, useState } from "react";
import API from "@amon/shared";
import { useNavigate } from "react-router-dom";
import { useToast } from "../../Components/UI/Toast";
import { getBackendErrorMessage, parseApiResponse } from "../../Utils/apiError";
import "../Styles/Dashboard.css";
import { buildNodeLayout } from "./web_social/graphLayout";
import { usePivotGraphControls } from "./web_social/usePivotGraphControls";
import WebSocialSearchResults from "./web_social/WebSocialSearchResults";

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

const DashboardWebSocialMediaIntelligence = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [query, setQuery] = useState("");
  const [isConnected, setIsConnected] = useState(getStoredInternetConnection);
  const [isSearching, setIsSearching] = useState(false);
  const [searchElapsedMs, setSearchElapsedMs] = useState(0);
  const [searchResult, setSearchResult] = useState(null);
  const [searchError, setSearchError] = useState("");

  const requestIntelConnectivity = useCallback(async () => {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Missing session token. Please log in again.");

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
    if (!token) throw new Error("Missing session token. Please log in again.");

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

  const handleSearchSubmit = useCallback(async (event) => {
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
  }, [addToast, isConnected, isSearching, query, requestIntelConnectivity, requestIntelSearch]);

  const graphNodes = useMemo(() => (Array.isArray(searchResult?.graph?.nodes) ? searchResult.graph.nodes : []), [searchResult]);
  const graphEdges = useMemo(() => (Array.isArray(searchResult?.graph?.edges) ? searchResult.graph.edges : []), [searchResult]);
  const sourceStatuses = useMemo(() => (Array.isArray(searchResult?.sources) ? searchResult.sources : []), [searchResult]);
  const timeline = useMemo(() => (Array.isArray(searchResult?.timeline) ? searchResult.timeline : []), [searchResult]);

  const pivotNodes = useMemo(() => buildNodeLayout(graphNodes, graphEdges), [graphEdges, graphNodes]);
  const pivotNodeById = useMemo(() => new Map(pivotNodes.map((node) => [node.id, node])), [pivotNodes]);
  const pivotEdges = useMemo(
    () => graphEdges.map((edge, index) => {
      const fromNode = pivotNodeById.get(String(edge?.from || ""));
      const toNode = pivotNodeById.get(String(edge?.to || ""));
      if (!fromNode || !toNode) return null;
      return {
        ...edge,
        id: edge?.id || `${fromNode.id}|${toNode.id}|${edge?.relation || index}`,
        fromNode,
        toNode,
      };
    }).filter(Boolean),
    [graphEdges, pivotNodeById]
  );

  const graphControls = usePivotGraphControls({ pivotNodes, pivotNodeById });
  const selectedNode = useMemo(() => {
    if (!graphControls.selectedNodeId) return null;
    return pivotNodes.find((node) => node.id === graphControls.selectedNodeId) || null;
  }, [graphControls.selectedNodeId, pivotNodes]);
  const selectedNodeRelations = useMemo(() => {
    return pivotEdges.filter((edge) => edge.fromNode?.id === graphControls.selectedNodeId || edge.toNode?.id === graphControls.selectedNodeId);
  }, [graphControls.selectedNodeId, pivotEdges]);
  const selectedNodeEvidence = useMemo(() => (Array.isArray(selectedNode?.evidence) ? selectedNode.evidence : []), [selectedNode]);
  const summary = searchResult?.summary || {};

  return (
    <section className="web-social-search-engine-page">
      <div className="web-social-top-left-back">
        <button type="button" className="web-social-back-button" onClick={() => navigate("/dashboard")} aria-label="Back to Dashboard">
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

        {!isSearching && searchError ? <p className="osint-search-error web-social-search-results">{searchError}</p> : null}
        {!isSearching && searchResult ? (
          <WebSocialSearchResults
            query={query}
            searchResult={searchResult}
            graphNodes={graphNodes}
            graphEdges={graphEdges}
            sourceStatuses={sourceStatuses}
            timeline={timeline}
            summary={summary}
            pivotNodes={pivotNodes}
            pivotEdges={pivotEdges}
            pivotNodeById={pivotNodeById}
            selectedNode={selectedNode}
            selectedNodeRelations={selectedNodeRelations}
            selectedNodeEvidence={selectedNodeEvidence}
            graphControls={graphControls}
          />
        ) : null}
      </div>
    </section>
  );
};

export default DashboardWebSocialMediaIntelligence;
