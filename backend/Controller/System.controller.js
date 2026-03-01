import getSystemStats from "../Services/status.service.js";
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
