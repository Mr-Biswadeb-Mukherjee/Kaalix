import {
  COMMON_EMAIL_DOMAINS,
  COMPANY_HINTS,
  MAX_EMAIL_CANDIDATES,
  MAX_USERNAME_CANDIDATES,
  domainPattern,
  emailPattern,
  usernamePattern,
} from "./constants.js";

export const cleanWhitespace = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

export const stripHtml = (value = "") =>
  cleanWhitespace(String(value || "").replace(/<[^>]*>/g, " "));

export const removeWwwPrefix = (hostname = "") =>
  hostname.startsWith("www.") ? hostname.slice(4) : hostname;

export const normalizeHandle = (value = "") => String(value || "").trim().replace(/^@+/, "");

export const normalizeEmail = (value = "") => {
  const normalized = cleanWhitespace(value).toLowerCase();
  if (!normalized) return "";
  const match = normalized.match(emailPattern);
  if (!match) return "";
  const local = cleanWhitespace(match[1]);
  const domain = cleanWhitespace(match[2]).toLowerCase();
  if (!local || !domainPattern.test(domain)) return "";
  return `${local}@${domain}`;
};

export const isLikelyEmail = (value = "") => Boolean(normalizeEmail(value));

export const normalizeWebsiteUrl = (value = "") => {
  const text = cleanWhitespace(value);
  if (!text) return "";
  const candidate = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  try {
    const url = new URL(candidate);
    if (!/^https?:$/i.test(url.protocol)) return "";
    return url.toString();
  } catch {
    return "";
  }
};

export const hashText = (value = "") => {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

export const toSafeIdFragment = (value = "") => {
  const normalized = cleanWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || `id-${hashText(value)}`;
};

export const normalizeDomain = (value = "") => {
  const raw = cleanWhitespace(value).toLowerCase();
  if (!raw) return "";

  const hasHttpScheme = raw.startsWith("http://") || raw.startsWith("https://");
  const urlText = hasHttpScheme ? raw : `https://${raw}`;

  try {
    const hostname = removeWwwPrefix(new URL(urlText).hostname.toLowerCase());
    if (!domainPattern.test(hostname)) return "";
    return hostname;
  } catch {
    return "";
  }
};

export const isLikelyDomain = (value = "") => Boolean(normalizeDomain(value));

export const normalizeUsername = (value = "") => {
  const normalized = cleanWhitespace(value).replace(/^@+/, "").toLowerCase();
  if (!normalized) return "";
  if (!usernamePattern.test(normalized)) return "";
  return normalized;
};

export const isLikelyUsername = (value = "") => {
  const candidate = cleanWhitespace(value);
  if (!candidate || candidate.includes(" ")) return false;
  if (isLikelyDomain(candidate)) return false;
  return Boolean(normalizeUsername(candidate));
};

export const extractUsernameFromKnownUrl = (value = "") => {
  const text = cleanWhitespace(value);
  if (!text.includes("/") && !/^https?:\/\//i.test(text)) return "";

  const candidateUrl = /^https?:\/\//i.test(text) ? text : `https://${text}`;

  try {
    const url = new URL(candidateUrl);
    const host = removeWwwPrefix(url.hostname.toLowerCase());
    const parts = url.pathname
      .split("/")
      .map((part) => cleanWhitespace(part))
      .filter(Boolean);

    if ((host === "x.com" || host === "twitter.com") && parts[0]) {
      return normalizeUsername(parts[0]);
    }
    if (host === "github.com" && parts[0]) {
      return normalizeUsername(parts[0]);
    }
    if (host === "instagram.com" && parts[0]) {
      return normalizeUsername(parts[0]);
    }
    if (host === "reddit.com" && parts[0] === "user" && parts[1]) {
      return normalizeUsername(parts[1]);
    }
    if (host === "keybase.io" && parts[0]) {
      return normalizeUsername(parts[0]);
    }

    return "";
  } catch {
    return "";
  }
};

export const inferQueryType = (query) => {
  if (isLikelyEmail(query)) return "email";
  if (isLikelyDomain(query)) return "domain";

  const directUsername = normalizeUsername(query) || extractUsernameFromKnownUrl(query);
  if (directUsername) return "username";

  const words = cleanWhitespace(query)
    .toLowerCase()
    .split(" ")
    .filter(Boolean);
  if (words.length === 0) return "unknown";

  const hasCompanyHint = words.some((word) => COMPANY_HINTS.has(word));
  if (hasCompanyHint) return "company";

  const looksLikePersonName =
    words.length >= 2 &&
    words.length <= 4 &&
    words.every((word) => /^[a-z][a-z.'-]*$/.test(word));

  if (looksLikePersonName) return "individual";

  return "unknown";
};

export const generateUsernameCandidates = (query, queryType) => {
  const raw = cleanWhitespace(query);
  const candidates = [];

  const pushCandidate = (value) => {
    const normalized = normalizeUsername(value);
    if (!normalized) return;
    if (candidates.includes(normalized)) return;
    if (isLikelyDomain(normalized)) return;
    candidates.push(normalized);
  };

  const direct = normalizeUsername(raw) || extractUsernameFromKnownUrl(raw);
  if (direct) pushCandidate(direct);

  if (queryType === "individual" || queryType === "unknown") {
    const tokens = raw
      .toLowerCase()
      .split(/\s+/)
      .map((entry) => entry.replace(/[^a-z0-9]/g, ""))
      .filter(Boolean);

    if (tokens.length >= 2) {
      const first = tokens[0];
      const last = tokens[tokens.length - 1];
      pushCandidate(`${first}${last}`);
      pushCandidate(`${first}.${last}`);
      pushCandidate(`${first}_${last}`);
      pushCandidate(`${first}${last.slice(0, 1)}`);
      pushCandidate(`${first.slice(0, 1)}${last}`);
    } else if (tokens.length === 1 && isLikelyUsername(tokens[0])) {
      pushCandidate(tokens[0]);
    }
  }

  if (queryType === "username" && !direct && isLikelyUsername(raw)) {
    pushCandidate(raw);
  }

  if (queryType === "email") {
    const normalizedEmail = normalizeEmail(raw);
    const local = normalizedEmail.split("@")[0] || "";
    if (local) {
      pushCandidate(local);
      pushCandidate(local.split("+")[0]);
      pushCandidate(local.replace(/\./g, ""));
    }
  }

  return candidates.slice(0, MAX_USERNAME_CANDIDATES);
};

export const generateEmailCandidates = (query, queryType, usernames = [], knownDomains = []) => {
  const candidates = [];
  const pushEmail = (value) => {
    const normalized = normalizeEmail(value);
    if (!normalized) return;
    if (candidates.includes(normalized)) return;
    candidates.push(normalized);
  };

  if (queryType === "email") {
    pushEmail(query);
  }

  const cleanUsernames = usernames.map((entry) => normalizeUsername(entry)).filter(Boolean);
  const domainSeeds = Array.from(
    new Set([
      ...knownDomains.map((entry) => normalizeDomain(entry)).filter(Boolean),
      ...COMMON_EMAIL_DOMAINS,
    ])
  );

  for (const username of cleanUsernames.slice(0, MAX_USERNAME_CANDIDATES)) {
    for (const domain of domainSeeds) {
      if (candidates.length >= MAX_EMAIL_CANDIDATES) {
        return candidates;
      }
      pushEmail(`${username}@${domain}`);
    }
  }

  return candidates.slice(0, MAX_EMAIL_CANDIDATES);
};

export const truncateText = (text = "", maxLen = 120) => {
  const value = cleanWhitespace(text);
  if (!value || value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
};
