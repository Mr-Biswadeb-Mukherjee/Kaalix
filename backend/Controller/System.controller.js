import getSystemStats from "../Services/status.service.js";
import { checkIntelInternetConnectivity } from "../Services/intelConnectivity.service.js";
import { buildPublicIntelGraph } from "../Services/intelSearch.service.js";
import { getLocationSharingState } from "../Services/profile.service.js";

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
    message: result.connected
      ? "KaaliX Intelligence internet connectivity verified."
      : "KaaliX Intelligence could not reach the internet from the backend.",
  });
};

export const SearchIntelGraph = async (req, res) => {
  try {
    const query = typeof req.body?.query === "string" ? req.body.query : "";
    const intel = await buildPublicIntelGraph(query);

    return res.status(200).json({
      success: true,
      message: "KaaliX Intelligence graph built from public data sources.",
      ...intel,
    });
  } catch (err) {
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
