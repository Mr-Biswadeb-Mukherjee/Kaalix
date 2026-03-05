const SEARCH_ACTIVITY_KEYWORD = "intel.search_";

export const formatDateTime = (value) => {
  if (!value) return "Unknown";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";

  return parsed.toLocaleString();
};

export const normalizeLineValue = (value, fallback = "unknown") => {
  const normalized = typeof value === "string" ? value.trim() : "";
  return normalized || fallback;
};

export const buildTerminalLine = (entry) => {
  const timestamp = formatDateTime(entry?.loggedInAt);
  const ipAddress = normalizeLineValue(entry?.ipAddress);
  const userAgent = normalizeLineValue(entry?.userAgent);

  return `[${timestamp}] LOGIN_SUCCESS ip=${ipAddress} ua="${userAgent}"`;
};

export const buildActivityDetails = (entry) => {
  const description = normalizeLineValue(entry?.description, "");
  const method = normalizeLineValue(entry?.metadata?.method, "");
  const query = normalizeLineValue(entry?.metadata?.query, "");

  if (description && method) return `${description} (method: ${method})`;
  if (description && query) return `${description} (query: ${query})`;
  if (description) return description;
  if (method && query) return `method: ${method} • query: ${query}`;
  if (method) return `method: ${method}`;
  if (query) return `query: ${query}`;

  return "No additional details.";
};

export const formatActivityTypeLabel = (value) => {
  const normalized = normalizeLineValue(value, "unknown");
  return normalized.replace(/\./g, " · ").replace(/_/g, " ");
};

export const resolveActivityBadgeClass = (value) => {
  const normalized = normalizeLineValue(value, "").toLowerCase();

  if (
    normalized.includes("login_success") ||
    normalized.includes("password_changed") ||
    normalized.includes("mfa_enabled") ||
    normalized.includes("intel.search_success")
  ) {
    return "success";
  }

  if (normalized.includes("mfa_disabled") || normalized.includes("intel.search_failed")) {
    return "warning";
  }

  return "neutral";
};

export const formatNotificationTypeLabel = (value) => {
  const normalized = normalizeLineValue(value, "system");
  return normalized.replace(/\./g, " · ").replace(/_/g, " ");
};

export const resolveNotificationSeverityClass = (value) => {
  const normalized = normalizeLineValue(value, "info").toLowerCase();

  if (normalized === "critical") return "critical";
  if (normalized === "warning") return "warning";
  if (normalized === "success") return "success";

  return "neutral";
};

const extractQuotedText = (value = "") => {
  if (typeof value !== "string") return "";

  const match = value.match(/"([^"]+)"/);
  return match?.[1]?.trim() || "";
};

export const isSearchActivity = (activityType) =>
  normalizeLineValue(activityType, "").toLowerCase().includes(SEARCH_ACTIVITY_KEYWORD);

export const extractActivityQuery = (entry) => {
  const metadataQuery = normalizeLineValue(entry?.metadata?.query, "");
  if (metadataQuery) return metadataQuery;

  const quotedDescription = extractQuotedText(entry?.description);
  if (quotedDescription) return quotedDescription;

  return extractQuotedText(entry?.title);
};

export const extractActivityMethod = (entry) =>
  normalizeLineValue(entry?.metadata?.method, "");
