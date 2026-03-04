import getSystemStats from "../Services/status.service.js";
import { checkIntelInternetConnectivity } from "../Services/intelConnectivity.service.js";
import { buildPublicIntelGraph } from "../Services/intelSearch.service.js";
import { getLocationSharingState } from "../Services/profile.service.js";
import { rejectNonSuperAdmin } from "./orgAdmin/shared.js";
import {
  clearSerpApiKey,
  getIntelApiKeyStatus,
  saveSerpApiKey,
} from "../Services/intelApiKey.service.js";
import {
  recordUserActivitySafely,
  USER_ACTIVITY_TYPES,
} from "../Services/userActivity.service.js";

const FALLBACK_LOCATION_TEXT = "Unknown Location";

const formatCoordinates = (preciseLocation) => {
  const latitude = Number(preciseLocation?.latitude);
  const longitude = Number(preciseLocation?.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
};

const normalizeLocationText = (value) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text || text === "N/A") return null;
  return text;
};

const normalizeText = (value) => (typeof value === "string" ? value.trim() : "");

const resolveRequestIpAddress = (req) => {
  const forwardedFor = normalizeText(req.get("x-forwarded-for"));
  if (forwardedFor) {
    const firstForwardedAddress = forwardedFor.split(",")[0]?.trim();
    if (firstForwardedAddress) return firstForwardedAddress;
  }

  const directIp = normalizeText(req.ip);
  if (directIp) return directIp;

  return normalizeText(req.socket?.remoteAddress) || null;
};

export const FetchProtectedSystemStatus = async (req, res) => {
  const baseStats = getSystemStats();
  const { locationConsent, preciseLocation } = await getLocationSharingState(req.user.user_id);
  const locationSharingEnabled = locationConsent === true;
  const preciseLocationAvailable = Boolean(locationSharingEnabled && preciseLocation);
  const ipLocationText = normalizeLocationText(baseStats.location);
  const preciseLocationText =
    normalizeLocationText(preciseLocation?.locationLabel) || formatCoordinates(preciseLocation);

  const resolvedLocation = locationSharingEnabled
    ? (preciseLocationAvailable
        ? (preciseLocationText || ipLocationText || FALLBACK_LOCATION_TEXT)
        : (ipLocationText || FALLBACK_LOCATION_TEXT))
    : (locationConsent === null ? "Location permission required" : "Location sharing disabled");

  const stats = {
    ...baseStats,
    location: resolvedLocation,
    locationSharingEnabled,
    locationConsentRequired: locationConsent === null,
    preciseLocationAvailable,
    locationSource: locationSharingEnabled
      ? (preciseLocationAvailable ? "device-geolocation" : "ip-geolocation")
      : "blocked",
    preciseLocation,
  };

  return res.status(200).json({ success: true, stats });
};

export const CheckIntelConnectivity = async (req, res) => {
  const result = await checkIntelInternetConnectivity();

  return res.status(200).json({
    success: true,
    connected: result.connected,
    checks: result.checks,
    checkedAt: result.checkedAt,
    latencyMs: result.latencyMs,
    failureReasons: result.failureReasons,
    collectorCount: result.collectorCount,
    apiKeyConfigured: result.apiKeyConfigured,
    apiKeySource: result.apiKeySource,
    maskedApiKey: result.maskedApiKey,
    message: result.connected
      ? "KaaliX Intelligence engine is ready."
      : result.apiKeyConfigured
        ? "KaaliX Intelligence engine is not ready."
        : "KaaliX Intelligence engine is not ready. Configure SerpAPI key first.",
  });
};

export const SaveIntelSerpApiKey = async (req, res) => {
  if (rejectNonSuperAdmin(req, res)) return;

  const shouldClear = req.body?.clear === true;

  if (shouldClear) {
    const cleared = await clearSerpApiKey();
    const connectivity = await checkIntelInternetConnectivity();
    return res.status(200).json({
      success: true,
      message: "SerpAPI key removed from KaaliX Intel settings.",
      configured: cleared.configured,
      source: cleared.source,
      maskedApiKey: cleared.maskedKey,
      connectivity,
    });
  }

  const apiKey = typeof req.body?.apiKey === "string" ? req.body.apiKey : "";
  const saved = await saveSerpApiKey(apiKey);
  const connectivity = await checkIntelInternetConnectivity();

  return res.status(200).json({
    success: true,
    message: "SerpAPI key saved and activated for KaaliX engine.",
    configured: saved.configured,
    source: saved.source,
    maskedApiKey: saved.maskedKey,
    connectivity,
  });
};

export const FetchIntelSerpApiKeyStatus = async (req, res) => {
  if (rejectNonSuperAdmin(req, res)) return;

  const status = await getIntelApiKeyStatus();

  return res.status(200).json({
    success: true,
    configured: status.configured,
    source: status.source,
    maskedApiKey: status.maskedKey,
  });
};

export const SearchIntelGraph = async (req, res) => {
  const query = typeof req.body?.query === "string" ? req.body.query : "";
  const normalizedQuery = query.trim();
  const userId = req.user?.user_id || null;
  const requestIpAddress = resolveRequestIpAddress(req);
  const requestUserAgent = normalizeText(req.get("user-agent")) || null;

  try {
    const intel = await buildPublicIntelGraph(query);
    if (userId) {
      await recordUserActivitySafely({
        userId,
        activityType: USER_ACTIVITY_TYPES.INTEL_SEARCH_SUCCESS,
        title: "Intel graph search executed",
        description: `KaaliX intelligence search completed for "${normalizedQuery || query}".`,
        ipAddress: requestIpAddress,
        userAgent: requestUserAgent,
        metadata: {
          query: normalizedQuery || query,
          queryType: intel?.queryType || null,
          nodes: Number(intel?.summary?.nodes) || 0,
          edges: Number(intel?.summary?.edges) || 0,
          sourceHealth: intel?.summary?.sourceHealth || null,
          latencyMs: Number.isFinite(intel?.latencyMs) ? Number(intel.latencyMs) : null,
        },
      });
    }

    return res.status(200).json({
      success: true,
      message: "KaaliX Intelligence graph built via KaaliX Go engine.",
      ...intel,
    });
  } catch (err) {
    if (userId && normalizedQuery) {
      await recordUserActivitySafely({
        userId,
        activityType: USER_ACTIVITY_TYPES.INTEL_SEARCH_FAILED,
        title: "Intel graph search failed",
        description: `KaaliX intelligence search failed for "${normalizedQuery}".`,
        ipAddress: requestIpAddress,
        userAgent: requestUserAgent,
        metadata: {
          query: normalizedQuery,
          code: typeof err?.code === "string" ? err.code : null,
          status:
            Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599
              ? err.status
              : 500,
          reason: typeof err?.message === "string" ? err.message : null,
        },
      });
    }

    console.error("Error in SearchIntelGraph:", err);
    const status =
      Number.isInteger(err?.status) && err.status >= 400 && err.status <= 599 ? err.status : 500;
    const code =
      typeof err?.code === "string" && err.code.trim() ? err.code.trim() : "INTEL_SEARCH_FAILED";
    return res.status(status).json({
      success: false,
      message: err?.message || "Failed to build KaaliX Intelligence graph.",
      code,
    });
  }
};
