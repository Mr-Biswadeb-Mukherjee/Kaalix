import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import API from "@amon/shared";
import "./Styles/Dashboard.css";
import { DashboardModuleCards } from "./dashboardModules/components";
import { useToast } from "../Components/UI/Toast";
import { getBackendErrorMessage, parseApiResponse } from "../Utils/apiError";

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

const Dashboard = () => {
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [isConnectingInternet, setIsConnectingInternet] = useState(false);
  const [isInternetConnected, setIsInternetConnected] = useState(getStoredInternetConnection);

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

  const handleInternetToggle = useCallback(async (nextChecked) => {
    if (isConnectingInternet) return;

    if (!nextChecked) {
      setIsInternetConnected(false);
      setStoredInternetConnection(false);
      addToast("Internet connection turned off.", "info");
      return;
    }

    setIsConnectingInternet(true);
    try {
      const data = await requestIntelConnectivity();
      if (data?.connected) {
        setIsInternetConnected(true);
        setStoredInternetConnection(true);
        addToast(data?.message || "Internet connection established.", "success");
        return;
      }

      setIsInternetConnected(false);
      setStoredInternetConnection(false);
      addToast(data?.message || "Unable to connect to internet.", "error");
    } catch (err) {
      setIsInternetConnected(false);
      setStoredInternetConnection(false);
      addToast(getBackendErrorMessage(err), "error");
    } finally {
      setIsConnectingInternet(false);
    }
  }, [addToast, isConnectingInternet, requestIntelConnectivity]);

  const modules = useMemo(
    () => [
      {
        id: "web-social",
        route: "/dashboard/web-social-media-intelligence",
        icon: "web-social",
        stateLabel: "Live",
        stateClass: "live",
        title: "Web & Social Media Intelligence",
        description: "Run live public-data pivots, graph mapping, and identity expansion across web and social signals.",
        meta: "Graph pivots, source health, node inspection",
      },
      {
        id: "dark-web",
        route: "/dashboard/dark-web-intelligence",
        icon: "dark-web",
        stateLabel: "Preview",
        stateClass: "preview",
        title: "Dark Web Intelligence",
        description: "Monitor hidden services, actor chatter, and leaked references mapped to investigation entities.",
        meta: "Tor-source watchlists and keyword surveillance",
      },
      {
        id: "breach",
        route: "/dashboard/breach-exposure-intelligence",
        icon: "breach",
        stateLabel: "Planned",
        stateClass: "planned",
        title: "Breach & Exposure Intelligence",
        description: "Track credentials, leaked datasets, and exposed assets associated with organizations or identities.",
        meta: "Leak footprint and exposure scoring",
      },
      {
        id: "infra",
        route: "/dashboard/infrastructure-intelligence",
        icon: "infrastructure",
        stateLabel: "Planned",
        stateClass: "planned",
        title: "Infrastructure Intelligence",
        description: "Map DNS, registrar, certificates, and hosting overlaps to detect connected infrastructure.",
        meta: "Domain, IP, and service correlation",
      },
    ],
    []
  );

  const openModule = useCallback(
    (card) => {
      if (!card?.route) return;
      navigate(card.route);
    },
    [navigate]
  );

  return (
    <section className="dashboard-shell dashboard-page">
      <header className="dashboard-shell-header dashboard-header dashboard-command-header">
        <div className="dashboard-header-copy">
          <p className="dashboard-header-eyebrow">Command Center</p>
          <h1>KaaliX Intelligence Command Center</h1>
          <p>Select an intelligence lane to launch the dedicated workspace.</p>
        </div>
        <label
          className={`dashboard-header-connect-switch ${isInternetConnected ? "connected" : ""} ${isConnectingInternet ? "disabled" : ""}`}
        >
          <input
            type="checkbox"
            checked={isInternetConnected || isConnectingInternet}
            onChange={(event) => {
              void handleInternetToggle(event.target.checked);
            }}
            disabled={isConnectingInternet}
            aria-label="Connect to internet"
          />
          <span className="dashboard-header-switch-track" aria-hidden="true">
            <span className="dashboard-header-switch-thumb" />
          </span>
          <span className="dashboard-header-switch-label">
            {isConnectingInternet ? "Connecting..." : "Connect to Internet"}
          </span>
        </label>
      </header>

      <DashboardModuleCards cards={modules} onOpenModule={openModule} />
    </section>
  );
};

export default Dashboard;
