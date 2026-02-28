const GEO_TIMEOUT_MS = 12000;
const GEO_MAX_AGE_MS = 60000;
const SUCCESS_CACHE_MS = 2 * 60 * 1000;
const FAILURE_CACHE_MS = 30 * 1000;

let cachedLabel = null;
let cachedAt = 0;
let lastFailureAt = 0;
let inFlightPromise = null;

const formatCoordinatePair = (latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
};

const getCurrentPosition = () =>
  new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("Geolocation is not supported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: GEO_TIMEOUT_MS,
      maximumAge: GEO_MAX_AGE_MS,
    });
  });

const reverseGeocodeCoordinates = async (latitude, longitude, fallbackText) => {
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&format=jsonv2&zoom=12&addressdetails=1`
    );
    if (!response.ok) return fallbackText;

    const data = await response.json();
    const address = data?.address || {};
    const locality =
      address.city ||
      address.town ||
      address.village ||
      address.suburb ||
      address.county ||
      null;
    const region = address.state || address.region || null;
    const country = address.country || null;
    const parts = [locality, region, country].filter(Boolean);

    if (parts.length > 0) return parts.join(", ");
    if (typeof data?.display_name === "string" && data.display_name.trim()) {
      return data.display_name.trim();
    }
    return fallbackText;
  } catch {
    return fallbackText;
  }
};

export const getBrowserLocationLabel = async () => {
  const now = Date.now();
  if (cachedLabel && now - cachedAt < SUCCESS_CACHE_MS) return cachedLabel;
  if (lastFailureAt && now - lastFailureAt < FAILURE_CACHE_MS) return null;
  if (inFlightPromise) return inFlightPromise;

  inFlightPromise = (async () => {
    try {
      const position = await getCurrentPosition();
      const latitude = position?.coords?.latitude;
      const longitude = position?.coords?.longitude;
      const fallbackText = formatCoordinatePair(latitude, longitude);
      if (!fallbackText) {
        lastFailureAt = Date.now();
        return null;
      }

      const label = await reverseGeocodeCoordinates(latitude, longitude, fallbackText);
      cachedLabel = label;
      cachedAt = Date.now();
      return label;
    } catch {
      lastFailureAt = Date.now();
      return null;
    } finally {
      inFlightPromise = null;
    }
  })();

  return inFlightPromise;
};
