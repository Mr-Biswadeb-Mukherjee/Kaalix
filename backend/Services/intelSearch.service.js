import { createHash } from "node:crypto";
import fetch from "node-fetch";
import { checkIntelInternetConnectivity } from "./intelConnectivity.service.js";

const DEFAULT_HTTP_TIMEOUT_MS = 7000;
const USERNAME_PROBE_TIMEOUT_MS = 6000;
const MAX_QUERY_LENGTH = 120;
const MAX_WIKIDATA_RESULTS = 5;
const MAX_WIKIPEDIA_RESULTS = 6;
const MAX_GITHUB_RESULTS = 6;
const MAX_WIKIDATA_DETAILS = 4;
const MAX_DOMAIN_CERT_LOOKUPS = 3;
const MAX_SUBDOMAINS_PER_DOMAIN = 18;
const MAX_USERNAME_CANDIDATES = 4;
const MAX_DNS_VALUES_PER_TYPE = 6;
const MAX_RDAP_NAMESERVERS = 8;
const MAX_EMAIL_CANDIDATES = 6;
const MAX_GRAVATAR_PROBES = 6;
const MAX_NODE_EVIDENCE = 6;

const SOCIAL_PROPERTY_MAP = Object.freeze([
  {
    property: "P2002",
    platform: "x",
    relation: "x_account",
    toUrl: (value) => `https://x.com/${String(value).replace(/^@/, "")}`,
  },
  {
    property: "P2003",
    platform: "instagram",
    relation: "instagram_account",
    toUrl: (value) => `https://www.instagram.com/${String(value).replace(/^@/, "")}`,
  },
  {
    property: "P2013",
    platform: "facebook",
    relation: "facebook_account",
    toUrl: (value) => `https://www.facebook.com/${value}`,
  },
  {
    property: "P2037",
    platform: "github",
    relation: "github_account",
    toUrl: (value) => `https://github.com/${value}`,
  },
  {
    property: "P2397",
    platform: "youtube",
    relation: "youtube_channel",
    toUrl: (value) => `https://www.youtube.com/channel/${value}`,
  },
]);

const COMPANY_HINTS = new Set([
  "inc",
  "inc.",
  "llc",
  "ltd",
  "ltd.",
  "corp",
  "corp.",
  "corporation",
  "company",
  "group",
  "systems",
  "technologies",
  "technology",
  "solutions",
  "labs",
  "limited",
  "plc",
  "gmbh",
  "holdings",
]);

const usernamePattern = /^(?=.{2,39}$)[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i;
const emailPattern =
  /^(?=.{6,320}$)([a-z0-9!#$%&'*+/=?^_`{|}~.-]+)@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i;
const domainPattern =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;
const COMMON_EMAIL_DOMAINS = Object.freeze([
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);

const cleanWhitespace = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const stripHtml = (value = "") => cleanWhitespace(String(value || "").replace(/<[^>]*>/g, " "));

const removeWwwPrefix = (hostname = "") =>
  hostname.startsWith("www.") ? hostname.slice(4) : hostname;

const normalizeHandle = (value = "") => String(value || "").trim().replace(/^@+/, "");

const normalizeEmail = (value = "") => {
  const normalized = cleanWhitespace(value).toLowerCase();
  if (!normalized) return "";
  const match = normalized.match(emailPattern);
  if (!match) return "";
  const local = cleanWhitespace(match[1]);
  const domain = cleanWhitespace(match[2]).toLowerCase();
  if (!local || !domainPattern.test(domain)) return "";
  return `${local}@${domain}`;
};

const isLikelyEmail = (value = "") => Boolean(normalizeEmail(value));

const normalizeWebsiteUrl = (value = "") => {
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

const hashText = (value = "") => {
  let hash = 0;
  const text = String(value || "");
  for (let i = 0; i < text.length; i += 1) {
    hash = ((hash << 5) - hash + text.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
};

const toSafeIdFragment = (value = "") => {
  const normalized = cleanWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72);
  return normalized || `id-${hashText(value)}`;
};

const normalizeDomain = (value = "") => {
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

const isLikelyDomain = (value = "") => Boolean(normalizeDomain(value));

const normalizeUsername = (value = "") => {
  const normalized = cleanWhitespace(value).replace(/^@+/, "").toLowerCase();
  if (!normalized) return "";
  if (!usernamePattern.test(normalized)) return "";
  return normalized;
};

const isLikelyUsername = (value = "") => {
  const candidate = cleanWhitespace(value);
  if (!candidate || candidate.includes(" ")) return false;
  if (isLikelyDomain(candidate)) return false;
  return Boolean(normalizeUsername(candidate));
};

const extractUsernameFromKnownUrl = (value = "") => {
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

const inferQueryType = (query) => {
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

const generateUsernameCandidates = (query, queryType) => {
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

const generateEmailCandidates = (query, queryType, usernames = [], knownDomains = []) => {
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

const createHttpError = (status, message, code) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "KaaliX-Intel-Graph/1.0",
        ...(options?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
};

const fetchJson = async (url, options = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) => {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
};

const fetchOptionalJson = async (url, options = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) => {
  try {
    const response = await fetchWithTimeout(url, options, timeoutMs);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};

const parseWikidataClaimValues = (claims = {}, propertyId, maxValues = 3) => {
  const statements = Array.isArray(claims?.[propertyId]) ? claims[propertyId] : [];
  const values = [];

  for (const statement of statements) {
    if (values.length >= maxValues) break;
    const dataValue = statement?.mainsnak?.datavalue?.value;
    if (typeof dataValue === "string" && cleanWhitespace(dataValue)) {
      values.push(cleanWhitespace(dataValue));
      continue;
    }
    if (typeof dataValue?.text === "string" && cleanWhitespace(dataValue.text)) {
      values.push(cleanWhitespace(dataValue.text));
    }
  }

  return values;
};

const searchWikidataEntities = async (query) => {
  const url =
    "https://www.wikidata.org/w/api.php?action=wbsearchentities&language=en&format=json" +
    `&limit=${MAX_WIKIDATA_RESULTS}&search=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  const rows = Array.isArray(data?.search) ? data.search : [];
  return rows.map((entry) => ({
    id: String(entry?.id || "").trim(),
    label: cleanWhitespace(entry?.label || ""),
    description: cleanWhitespace(entry?.description || ""),
    conceptUri: cleanWhitespace(entry?.concepturi || ""),
  }));
};

const fetchWikidataEntityDetails = async (entityId) => {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(entityId)}.json`;
  const data = await fetchJson(url);
  const entity = data?.entities?.[entityId];
  if (!entity || typeof entity !== "object") {
    return { websites: [], profiles: [] };
  }

  const claims = entity?.claims || {};
  const websites = parseWikidataClaimValues(claims, "P856", 3)
    .map((rawUrl) => {
      const domain = normalizeDomain(rawUrl);
      return domain ? { domain, url: rawUrl } : null;
    })
    .filter(Boolean);

  const profiles = [];
  for (const entry of SOCIAL_PROPERTY_MAP) {
    const values = parseWikidataClaimValues(claims, entry.property, 3);
    for (const value of values) {
      const handle = normalizeHandle(value);
      if (!handle) continue;
      profiles.push({
        platform: entry.platform,
        relation: entry.relation,
        handle,
        url: entry.toUrl(handle),
      });
    }
  }

  return { websites, profiles };
};

const searchWikipedia = async (query) => {
  const url =
    "https://en.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1" +
    `&srlimit=${MAX_WIKIPEDIA_RESULTS}&srsearch=${encodeURIComponent(query)}`;
  const data = await fetchJson(url);
  const rows = Array.isArray(data?.query?.search) ? data.query.search : [];

  return rows.map((entry) => ({
    pageId: Number(entry?.pageid) || null,
    title: cleanWhitespace(entry?.title || ""),
    snippet: stripHtml(entry?.snippet || ""),
    timestamp: cleanWhitespace(entry?.timestamp || ""),
  }));
};

const searchGithubUsers = async (query) => {
  const url =
    "https://api.github.com/search/users" +
    `?q=${encodeURIComponent(`${query} in:login in:name`)}&per_page=${MAX_GITHUB_RESULTS}`;
  const data = await fetchJson(
    url,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    },
    6500
  );
  const items = Array.isArray(data?.items) ? data.items : [];

  return items.map((entry) => ({
    login: cleanWhitespace(entry?.login || ""),
    type: cleanWhitespace(entry?.type || ""),
    profileUrl: cleanWhitespace(entry?.html_url || ""),
    score: Number(entry?.score) || 0,
  }));
};

const fetchCertificateSubdomains = async (domain) => {
  const url = `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}&output=json`;
  let response;

  try {
    response = await fetchWithTimeout(url, {}, 8000);
  } catch {
    return [];
  }

  if (!response.ok) return [];

  const bodyText = await response.text();
  if (!bodyText.trim()) return [];

  let parsed;
  try {
    parsed = JSON.parse(bodyText);
  } catch {
    return [];
  }

  if (!Array.isArray(parsed)) return [];

  const names = new Set();
  for (const row of parsed) {
    const rawNames = String(row?.name_value || "")
      .split("\n")
      .map((name) => cleanWhitespace(name).toLowerCase())
      .filter(Boolean);

    for (const name of rawNames) {
      if (name === domain || name.endsWith(`.${domain}`)) {
        names.add(name);
      }
      if (names.size >= MAX_SUBDOMAINS_PER_DOMAIN) {
        return Array.from(names);
      }
    }
  }

  return Array.from(names);
};

const resolveDnsRecordType = async (domain, type) => {
  const url =
    "https://dns.google/resolve" +
    `?name=${encodeURIComponent(domain)}&type=${encodeURIComponent(type)}`;
  const data = await fetchOptionalJson(url, {}, 7000);
  if (!data || !Array.isArray(data?.Answer)) return [];

  const values = [];
  for (const answer of data.Answer) {
    if (values.length >= MAX_DNS_VALUES_PER_TYPE) break;
    const raw = cleanWhitespace(answer?.data || "");
    if (!raw) continue;

    if (type === "MX") {
      const mxHost = raw.split(/\s+/).pop() || "";
      const normalizedMx = mxHost.replace(/\.$/, "").toLowerCase();
      if (normalizedMx) values.push(normalizedMx);
      continue;
    }

    if (type === "TXT") {
      const normalizedTxt = raw.replace(/^"|"$/g, "");
      if (normalizedTxt) values.push(normalizedTxt);
      continue;
    }

    values.push(raw.replace(/\.$/, "").toLowerCase());
  }

  return Array.from(new Set(values));
};

const fetchDomainDnsIntel = async (domain) => {
  const recordTypes = ["A", "AAAA", "MX", "NS", "TXT"];

  const settled = await Promise.allSettled(
    recordTypes.map((type) => resolveDnsRecordType(domain, type))
  );

  const records = { A: [], AAAA: [], MX: [], NS: [], TXT: [] };
  let failures = 0;

  for (let i = 0; i < settled.length; i += 1) {
    const type = recordTypes[i];
    const result = settled[i];
    if (result.status === "fulfilled") {
      records[type] = Array.isArray(result.value) ? result.value : [];
    } else {
      failures += 1;
      records[type] = [];
    }
  }

  return {
    records,
    failures,
    lookedUp: recordTypes.length,
  };
};

const getEntityVCardValue = (entity, key) => {
  const rows = Array.isArray(entity?.vcardArray?.[1]) ? entity.vcardArray[1] : [];
  const row = rows.find((entry) => Array.isArray(entry) && entry[0] === key);
  return cleanWhitespace(row?.[3] || "");
};

const fetchDomainRdapIntel = async (domain) => {
  const data = await fetchOptionalJson(`https://rdap.org/domain/${encodeURIComponent(domain)}`, {}, 8000);
  if (!data || typeof data !== "object") return null;

  const nameservers = Array.isArray(data?.nameservers)
    ? data.nameservers
        .map((entry) => cleanWhitespace(entry?.ldhName || "").toLowerCase())
        .filter(Boolean)
        .slice(0, MAX_RDAP_NAMESERVERS)
    : [];

  const registrarEntity = (Array.isArray(data?.entities) ? data.entities : []).find((entity) =>
    Array.isArray(entity?.roles) ? entity.roles.includes("registrar") : false
  );

  const registrarName =
    cleanWhitespace(getEntityVCardValue(registrarEntity, "fn")) ||
    cleanWhitespace(getEntityVCardValue(registrarEntity, "org"));

  const statuses = Array.isArray(data?.status)
    ? data.status.map((entry) => cleanWhitespace(entry)).filter(Boolean).slice(0, 6)
    : [];

  return {
    domain: cleanWhitespace(data?.ldhName || domain).toLowerCase(),
    registrarName,
    nameservers,
    statuses,
  };
};

const probeGithubUsername = async (username) => {
  const sourceUrl = `https://api.github.com/users/${encodeURIComponent(username)}`;
  const data = await fetchOptionalJson(
    sourceUrl,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    },
    USERNAME_PROBE_TIMEOUT_MS
  );
  if (!data?.login) return null;

  const cleanHandle = cleanWhitespace(data.login);
  const email = normalizeEmail(data?.email || "");
  const blog = normalizeWebsiteUrl(data?.blog || "");
  const twitterUsername = normalizeUsername(data?.twitter_username || "");

  return {
    platform: "github",
    relation: "github_account",
    handle: cleanHandle,
    url: cleanWhitespace(data.html_url || `https://github.com/${username}`),
    description: cleanWhitespace(data.bio || data.type || "GitHub profile"),
    confidence: 0.96,
    source: "github_exact",
    sourceUrl,
    emails: email ? [email] : [],
    websites: blog ? [{ url: blog, source: "github_exact", confidence: 0.88 }] : [],
    relatedProfiles: twitterUsername
      ? [
          {
            platform: "x",
            relation: "x_account",
            handle: twitterUsername,
            url: `https://x.com/${twitterUsername}`,
            source: "github_exact",
            confidence: 0.86,
            description: "Linked from GitHub profile metadata",
          },
        ]
      : [],
  };
};

const probeRedditUsername = async (username) => {
  const sourceUrl = `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`;
  const data = await fetchOptionalJson(
    sourceUrl,
    {
      headers: {
        Accept: "application/json",
      },
    },
    USERNAME_PROBE_TIMEOUT_MS
  );

  const user = data?.data;
  const handle = cleanWhitespace(user?.name || "");
  if (!handle) return null;

  return {
    platform: "reddit",
    relation: "reddit_account",
    handle,
    url: `https://www.reddit.com/user/${handle}`,
    description: `Reddit account · karma ${Number(user?.total_karma) || 0}`,
    confidence: 0.94,
    source: "reddit_exact",
    sourceUrl,
    emails: [],
    websites: [],
    relatedProfiles: [],
  };
};

const probeHackerNewsUsername = async (username) => {
  const sourceUrl = `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`;
  const data = await fetchOptionalJson(sourceUrl, {}, USERNAME_PROBE_TIMEOUT_MS);
  const handle = cleanWhitespace(data?.id || "");
  if (!handle) return null;

  return {
    platform: "hackernews",
    relation: "hackernews_account",
    handle,
    url: `https://news.ycombinator.com/user?id=${encodeURIComponent(handle)}`,
    description: `Hacker News account · karma ${Number(data?.karma) || 0}`,
    confidence: 0.93,
    source: "hackernews_exact",
    sourceUrl,
    emails: [],
    websites: [],
    relatedProfiles: [],
  };
};

const parseKeybaseProofs = (proofRows = []) => {
  const relatedProfiles = [];
  const websites = [];
  const proofTypeToProfile = {
    twitter: {
      platform: "x",
      relation: "x_account",
      toUrl: (name) => `https://x.com/${name}`,
      confidence: 0.85,
    },
    github: {
      platform: "github",
      relation: "github_account",
      toUrl: (name) => `https://github.com/${name}`,
      confidence: 0.88,
    },
    reddit: {
      platform: "reddit",
      relation: "reddit_account",
      toUrl: (name) => `https://www.reddit.com/user/${name}`,
      confidence: 0.84,
    },
    hackernews: {
      platform: "hackernews",
      relation: "hackernews_account",
      toUrl: (name) => `https://news.ycombinator.com/user?id=${encodeURIComponent(name)}`,
      confidence: 0.83,
    },
    facebook: {
      platform: "facebook",
      relation: "facebook_account",
      toUrl: (name) => `https://www.facebook.com/${name}`,
      confidence: 0.78,
    },
    instagram: {
      platform: "instagram",
      relation: "instagram_account",
      toUrl: (name) => `https://www.instagram.com/${name}`,
      confidence: 0.79,
    },
  };

  for (const proof of proofRows) {
    const type = cleanWhitespace(proof?.proof_type || proof?.proofType || "").toLowerCase();
    const name = normalizeHandle(proof?.nametag || proof?.username || proof?.user || "");
    const meta = proofTypeToProfile[type];

    if (meta && name) {
      relatedProfiles.push({
        platform: meta.platform,
        relation: meta.relation,
        handle: name,
        url: cleanWhitespace(proof?.service_url || meta.toUrl(name)),
        source: "keybase_exact",
        confidence: meta.confidence,
        description: "Linked via Keybase proof",
      });
      continue;
    }

    if ((type === "web" || type === "http" || type === "https") && proof?.service_url) {
      const websiteUrl = normalizeWebsiteUrl(proof.service_url);
      if (!websiteUrl) continue;
      websites.push({
        url: websiteUrl,
        source: "keybase_exact",
        confidence: 0.74,
      });
    }
  }

  return { relatedProfiles, websites };
};

const probeKeybaseUsername = async (username) => {
  const sourceUrl = `https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(username)}`;
  const data = await fetchOptionalJson(sourceUrl, {}, USERNAME_PROBE_TIMEOUT_MS);

  const profile = Array.isArray(data?.them) ? data.them[0] : null;
  const handle = cleanWhitespace(profile?.basics?.username || "");
  if (!handle) return null;

  const proofRows = Array.isArray(profile?.proofs_summary?.all) ? profile.proofs_summary.all : [];
  const proofIntel = parseKeybaseProofs(proofRows);

  return {
    platform: "keybase",
    relation: "keybase_account",
    handle,
    url: `https://keybase.io/${encodeURIComponent(handle)}`,
    description: cleanWhitespace(profile?.profile?.full_name || "Keybase account"),
    confidence: 0.92,
    source: "keybase_exact",
    sourceUrl,
    emails: [],
    websites: proofIntel.websites,
    relatedProfiles: proofIntel.relatedProfiles,
  };
};

const probePublicProfileByUrl = async (input) => {
  const platform = cleanWhitespace(input?.platform || "").toLowerCase();
  const username = normalizeUsername(input?.username || "");
  const url = cleanWhitespace(input?.url || "");
  const relation = cleanWhitespace(input?.relation || "profile_link").toLowerCase();
  const source = cleanWhitespace(input?.source || "public_profile_probe");
  const confidence = Number.isFinite(input?.confidence) ? input.confidence : 0.66;
  const absenceMarkers = Array.isArray(input?.absenceMarkers) ? input.absenceMarkers : [];
  if (!platform || !username || !url) return null;

  let response;
  try {
    response = await fetchWithTimeout(
      url,
      {
        headers: {
          Accept: "text/html,application/xhtml+xml;q=0.9",
        },
      },
      USERNAME_PROBE_TIMEOUT_MS
    );
  } catch {
    return null;
  }

  if (!response.ok) return null;

  const html = (await response.text()).slice(0, 5000).toLowerCase();
  for (const marker of absenceMarkers) {
    const token = cleanWhitespace(marker).toLowerCase();
    if (token && html.includes(token)) return null;
  }

  return {
    platform,
    relation,
    handle: username,
    url,
    description: `${platform} profile candidate`,
    confidence,
    source,
    sourceUrl: url,
    emails: [],
    websites: [],
    relatedProfiles: [],
  };
};

const uniqueProfileEntries = (profiles = []) => {
  const seen = new Set();
  const out = [];
  for (const profile of profiles) {
    const platform = cleanWhitespace(profile?.platform || "").toLowerCase();
    const handle = normalizeHandle(profile?.handle || "").toLowerCase();
    if (!platform || !handle) continue;
    const key = `${platform}:${handle}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(profile);
  }
  return out;
};

const uniqueStrings = (values = []) => Array.from(new Set(values.map((entry) => cleanWhitespace(entry)).filter(Boolean)));

const uniqueWebsites = (websites = []) => {
  const seen = new Set();
  const out = [];
  for (const website of websites) {
    const websiteUrl = normalizeWebsiteUrl(website?.url || website);
    if (!websiteUrl || seen.has(websiteUrl)) continue;
    seen.add(websiteUrl);
    out.push({
      url: websiteUrl,
      source: website?.source || "public_data",
      confidence: Number.isFinite(website?.confidence) ? website.confidence : 0.72,
    });
  }
  return out;
};

const probeUsernameCandidate = async (username) => {
  const cleanUsername = normalizeUsername(username);
  if (!cleanUsername) {
    return {
      username,
      profiles: [],
      emails: [],
      websites: [],
      relatedProfiles: [],
      failures: 0,
      probes: 0,
    };
  }

  const probes = [
    probeGithubUsername(cleanUsername),
    probeRedditUsername(cleanUsername),
    probeHackerNewsUsername(cleanUsername),
    probeKeybaseUsername(cleanUsername),
    probePublicProfileByUrl({
      platform: "x",
      username: cleanUsername,
      relation: "x_account",
      source: "x_profile_probe",
      confidence: 0.67,
      url: `https://x.com/${encodeURIComponent(cleanUsername)}`,
      absenceMarkers: ["this account doesn", "this account doesn't", "account doesn’t exist"],
    }),
    probePublicProfileByUrl({
      platform: "instagram",
      username: cleanUsername,
      relation: "instagram_account",
      source: "instagram_profile_probe",
      confidence: 0.64,
      url: `https://www.instagram.com/${encodeURIComponent(cleanUsername)}/`,
      absenceMarkers: ["sorry, this page isn't available"],
    }),
    probePublicProfileByUrl({
      platform: "facebook",
      username: cleanUsername,
      relation: "facebook_account",
      source: "facebook_profile_probe",
      confidence: 0.52,
      url: `https://www.facebook.com/${encodeURIComponent(cleanUsername)}`,
      absenceMarkers: ["content isn't available right now", "content isn’t available right now"],
    }),
  ];

  const settled = await Promise.allSettled(probes);
  const profiles = [];
  const emails = [];
  const websites = [];
  const relatedProfiles = [];
  let failures = 0;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      if (!result.value) continue;
      profiles.push(result.value);
      emails.push(...(Array.isArray(result.value.emails) ? result.value.emails : []));
      websites.push(...(Array.isArray(result.value.websites) ? result.value.websites : []));
      relatedProfiles.push(...(Array.isArray(result.value.relatedProfiles) ? result.value.relatedProfiles : []));
      continue;
    }
    failures += 1;
  }

  return {
    username: cleanUsername,
    profiles: uniqueProfileEntries(profiles),
    emails: uniqueStrings(emails.map((entry) => normalizeEmail(entry))).filter(Boolean),
    websites: uniqueWebsites(websites),
    relatedProfiles: uniqueProfileEntries(relatedProfiles),
    failures,
    probes: settled.length,
  };
};

const normalizeEvidenceEntry = (entry = {}) => {
  const source = cleanWhitespace(entry?.source || "");
  const url = cleanWhitespace(entry?.url || "");
  const label = cleanWhitespace(entry?.label || "");
  if (!source && !url) return null;
  return {
    source: source || "public_data",
    url,
    label,
  };
};

const mergeEvidence = (previous = [], incoming = []) => {
  const merged = [];
  const seen = new Set();
  const allEntries = [...previous, ...incoming].map(normalizeEvidenceEntry).filter(Boolean);

  for (const entry of allEntries) {
    const key = `${entry.source}|${entry.url}|${entry.label}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(entry);
    if (merged.length >= MAX_NODE_EVIDENCE) break;
  }

  return merged;
};

const createGraph = () => {
  const nodes = new Map();
  const edges = new Map();

  const addNode = (node) => {
    if (!node?.id) return;
    if (!nodes.has(node.id)) {
      nodes.set(node.id, node);
      return;
    }

    const previous = nodes.get(node.id);
    nodes.set(node.id, {
      ...previous,
      ...node,
      source: previous.source || node.source,
      description: previous.description || node.description,
      url: previous.url || node.url,
      handle: previous.handle || node.handle,
      platform: previous.platform || node.platform,
      confidence: Math.max(Number(previous.confidence) || 0, Number(node.confidence) || 0),
      evidence: mergeEvidence(previous.evidence || [], node.evidence || []),
    });
  };

  const addEdge = (edge) => {
    if (!edge?.from || !edge?.to || !edge?.relation) return;
    const key = `${edge.from}|${edge.to}|${edge.relation}`;
    if (!edges.has(key)) {
      edges.set(key, {
        id: key,
        ...edge,
      });
      return;
    }

    const previous = edges.get(key);
    edges.set(key, {
      ...previous,
      ...edge,
      source: previous.source || edge.source,
      sourceUrl: previous.sourceUrl || edge.sourceUrl,
      confidence: Math.max(Number(previous.confidence) || 0, Number(edge.confidence) || 0),
    });
  };

  return {
    addNode,
    addEdge,
    toJson: () => ({
      nodes: Array.from(nodes.values()),
      edges: Array.from(edges.values()),
    }),
  };
};

const addProfileNodeToGraph = (graph, input) => {
  const platform = cleanWhitespace(input?.platform || "").toLowerCase();
  const handle = cleanWhitespace(input?.handle || "");
  const relation = cleanWhitespace(input?.relation || "profile_link").toLowerCase();
  if (!platform || !handle) return false;

  const nodeId = `profile:${platform}:${handle.toLowerCase()}`;
  graph.addNode({
    id: nodeId,
    type: "profile",
    platform,
    handle,
    label: `@${handle}`,
    source: input?.source || "public_data",
    url: input?.url || "",
    description: input?.description || "",
    confidence: typeof input?.confidence === "number" ? input.confidence : 0.8,
    evidence: [
      {
        source: input?.source || "public_data",
        url: input?.sourceUrl || input?.url || "",
        label: input?.sourceLabel || "",
      },
    ],
  });

  graph.addEdge({
    from: input?.fromId,
    to: nodeId,
    relation,
    source: input?.source || "public_data",
    sourceUrl: input?.sourceUrl || input?.url || "",
    confidence: typeof input?.confidence === "number" ? input.confidence : 0.8,
  });

  return true;
};

const addEmailNodeToGraph = (graph, input) => {
  const email = normalizeEmail(input?.email || "");
  if (!email) return "";
  const nodeId = `email:${email}`;
  graph.addNode({
    id: nodeId,
    type: "email",
    label: email,
    source: input?.source || "public_data",
    url: `mailto:${email}`,
    description: input?.description || "",
    confidence: Number.isFinite(input?.confidence) ? input.confidence : 0.76,
    evidence: [
      {
        source: input?.source || "public_data",
        url: input?.sourceUrl || "",
        label: input?.sourceLabel || "",
      },
    ],
  });

  if (input?.fromId) {
    graph.addEdge({
      from: input.fromId,
      to: nodeId,
      relation: cleanWhitespace(input?.relation || "related_email").toLowerCase(),
      source: input?.source || "public_data",
      sourceUrl: input?.sourceUrl || "",
      confidence: Number.isFinite(input?.confidence) ? input.confidence : 0.74,
    });
  }

  return nodeId;
};

const addWebsiteNodeToGraph = (graph, input) => {
  const websiteUrl = normalizeWebsiteUrl(input?.url || "");
  if (!websiteUrl) return "";
  const hostname = normalizeDomain(websiteUrl) || "";
  const nodeId = hostname ? `website:${hostname}` : `website:${toSafeIdFragment(websiteUrl)}`;
  graph.addNode({
    id: nodeId,
    type: "website",
    label: hostname || websiteUrl,
    source: input?.source || "public_data",
    url: websiteUrl,
    description: input?.description || "",
    confidence: Number.isFinite(input?.confidence) ? input.confidence : 0.72,
    evidence: [
      {
        source: input?.source || "public_data",
        url: input?.sourceUrl || websiteUrl,
        label: input?.sourceLabel || "",
      },
    ],
  });

  if (input?.fromId) {
    graph.addEdge({
      from: input.fromId,
      to: nodeId,
      relation: cleanWhitespace(input?.relation || "related_website").toLowerCase(),
      source: input?.source || "public_data",
      sourceUrl: input?.sourceUrl || websiteUrl,
      confidence: Number.isFinite(input?.confidence) ? input.confidence : 0.72,
    });
  }

  return nodeId;
};

const fetchGravatarByEmail = async (email) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) return null;
  const hash = createHash("md5").update(normalizedEmail).digest("hex");
  const sourceUrl = `https://www.gravatar.com/${hash}.json`;
  const data = await fetchOptionalJson(sourceUrl, {}, 7000);

  const entry = Array.isArray(data?.entry) ? data.entry[0] : null;
  if (!entry) return null;

  const profileUrl = cleanWhitespace(entry?.profileUrl || `https://gravatar.com/${hash}`);
  const displayName = cleanWhitespace(entry?.displayName || "");
  const aboutMe = cleanWhitespace(entry?.aboutMe || "");
  const relatedUrls = Array.isArray(entry?.urls)
    ? entry.urls.map((row) => normalizeWebsiteUrl(row?.value || "")).filter(Boolean).slice(0, 4)
    : [];

  return {
    hash,
    email: normalizedEmail,
    sourceUrl,
    profileUrl,
    avatarUrl: `https://www.gravatar.com/avatar/${hash}`,
    displayName,
    aboutMe,
    relatedUrls,
  };
};

const addGravatarNodeToGraph = (graph, input) => {
  const email = normalizeEmail(input?.email || "");
  const hash = cleanWhitespace(input?.hash || "");
  if (!email || !hash) return "";

  const nodeId = `gravatar:${hash}`;
  graph.addNode({
    id: nodeId,
    type: "gravatar",
    label: input?.displayName || `Gravatar ${email}`,
    source: input?.source || "gravatar",
    url: input?.profileUrl || "",
    description: input?.aboutMe || `Gravatar profile linked to ${email}`,
    confidence: Number.isFinite(input?.confidence) ? input.confidence : 0.9,
    evidence: [
      {
        source: input?.source || "gravatar",
        url: input?.sourceUrl || "",
        label: "Gravatar profile JSON",
      },
    ],
  });

  if (input?.fromId) {
    graph.addEdge({
      from: input.fromId,
      to: nodeId,
      relation: "gravatar_profile",
      source: input?.source || "gravatar",
      sourceUrl: input?.sourceUrl || "",
      confidence: Number.isFinite(input?.confidence) ? input.confidence : 0.9,
    });
  }

  return nodeId;
};

const buildSourceStatus = (id, label, status, records, error = "", url = "") => ({
  id,
  label,
  status,
  records: Number.isFinite(records) ? records : 0,
  error: cleanWhitespace(error),
  url: cleanWhitespace(url),
});

const createBuildTimeline = () => {
  const steps = [];

  const start = (id, label, detail = "") => ({
    id,
    label,
    detail: cleanWhitespace(detail),
    startedAt: Date.now(),
  });

  const finish = (token, status, records, message = "") => {
    steps.push({
      id: token.id,
      label: token.label,
      detail: token.detail,
      status,
      records: Number.isFinite(records) ? records : 0,
      message: cleanWhitespace(message),
      startedAt: new Date(token.startedAt).toISOString(),
      completedAt: new Date().toISOString(),
      durationMs: Math.max(0, Date.now() - token.startedAt),
    });
  };

  return {
    start,
    finish,
    toJson: () => [...steps],
  };
};

export const buildPublicIntelGraph = async (rawQuery) => {
  const query = cleanWhitespace(rawQuery);
  if (!query) {
    throw createHttpError(400, "Query is required.", "INTEL_QUERY_REQUIRED");
  }
  if (query.length < 2 || query.length > MAX_QUERY_LENGTH) {
    throw createHttpError(
      400,
      `Query must be between 2 and ${MAX_QUERY_LENGTH} characters.`,
      "INTEL_QUERY_INVALID"
    );
  }

  const connectivity = await checkIntelInternetConnectivity();
  if (!connectivity.connected) {
    throw createHttpError(
      503,
      "KaaliX Intelligence cannot access public internet from the backend.",
      "INTEL_CONNECTIVITY_OFFLINE"
    );
  }

  const graph = createGraph();
  const sourceStatus = [];
  const timeline = createBuildTimeline();
  const domains = new Set();
  const discoveredEmails = new Set();
  const queryType = inferQueryType(query);
  const rootId = `target:${query.toLowerCase()}`;
  const startedAt = Date.now();
  const normalizedQueryEmail = normalizeEmail(query);
  const normalizedQueryDomain = normalizeDomain(query);

  graph.addNode({
    id: rootId,
    type: queryType,
    label: query,
    source: "user_input",
    confidence: 1,
    evidence: [
      {
        source: "user_input",
        label: "Query seed",
      },
    ],
  });

  const seedStage = timeline.start("seed_analysis", "Seed Analysis", "Normalize query into known seed types");

  if (normalizedQueryEmail) {
    const emailNodeId = addEmailNodeToGraph(graph, {
      email: normalizedQueryEmail,
      fromId: rootId,
      relation: "input_email",
      source: "user_input",
      confidence: 1,
      description: "Input email seed",
    });
    if (emailNodeId) discoveredEmails.add(normalizedQueryEmail);
    const emailDomain = normalizedQueryEmail.split("@")[1] || "";
    const normalizedEmailDomain = normalizeDomain(emailDomain);
    if (normalizedEmailDomain) {
      domains.add(normalizedEmailDomain);
      graph.addNode({
        id: `domain:${normalizedEmailDomain}`,
        type: "domain",
        label: normalizedEmailDomain,
        source: "user_input",
        url: `https://${normalizedEmailDomain}`,
      });
      graph.addEdge({
        from: emailNodeId || rootId,
        to: `domain:${normalizedEmailDomain}`,
        relation: "email_domain",
        source: "user_input",
        sourceUrl: `mailto:${normalizedQueryEmail}`,
        confidence: 1,
      });
    }
  }

  if (normalizedQueryDomain) {
    domains.add(normalizedQueryDomain);
    graph.addNode({
      id: `domain:${normalizedQueryDomain}`,
      type: "domain",
      label: normalizedQueryDomain,
      source: "user_input",
      url: `https://${normalizedQueryDomain}`,
      evidence: [
        {
          source: "user_input",
          url: `https://${normalizedQueryDomain}`,
          label: "Input domain seed",
        },
      ],
    });
    graph.addEdge({
      from: rootId,
      to: `domain:${normalizedQueryDomain}`,
      relation: "input_domain",
      source: "user_input",
      sourceUrl: `https://${normalizedQueryDomain}`,
      confidence: 1,
    });
  }

  timeline.finish(
    seedStage,
    "ok",
    Number(Boolean(normalizedQueryDomain)) + Number(Boolean(normalizedQueryEmail)),
    queryType === "unknown" ? "Seed type inferred as unknown" : `Seed type: ${queryType}`
  );

  const usernameCandidates = generateUsernameCandidates(query, queryType);
  const usernameStage = timeline.start(
    "username_expansion",
    "Username Expansion",
    "Generate aliases and probe public username identities"
  );
  if (usernameCandidates.length > 0) {
    const probeResults = await Promise.allSettled(
      usernameCandidates.map((candidate) => probeUsernameCandidate(candidate))
    );

    let candidateNodes = 0;
    let profileRecords = 0;
    let emailRecords = 0;
    let websiteRecords = 0;
    let probeFailures = 0;

    for (let i = 0; i < usernameCandidates.length; i += 1) {
      const candidate = usernameCandidates[i];
      const candidateId = `username:${candidate}`;
      candidateNodes += 1;

      graph.addNode({
        id: candidateId,
        type: "username",
        label: `@${candidate}`,
        handle: candidate,
        source: candidate === normalizeUsername(query) ? "user_input" : "heuristic",
        evidence: [
          {
            source: "heuristic",
            label: "Username candidate",
          },
        ],
      });

      graph.addEdge({
        from: rootId,
        to: candidateId,
        relation: "username_candidate",
        source: "heuristic",
        sourceUrl: "",
        confidence: candidate === normalizeUsername(query) ? 0.98 : 0.62,
      });

      const result = probeResults[i];
      if (result.status !== "fulfilled") {
        probeFailures += 1;
        continue;
      }

      probeFailures += result.value.failures;

      for (const profile of result.value.profiles) {
        const added = addProfileNodeToGraph(graph, {
          ...profile,
          fromId: candidateId,
        });
        if (added) profileRecords += 1;
      }

      for (const profile of result.value.relatedProfiles || []) {
        const added = addProfileNodeToGraph(graph, {
          ...profile,
          fromId: candidateId,
        });
        if (added) profileRecords += 1;
      }

      for (const email of result.value.emails || []) {
        const emailNodeId = addEmailNodeToGraph(graph, {
          email,
          fromId: candidateId,
          relation: "related_email",
          source: "identity_probe",
          sourceUrl: "",
          confidence: 0.82,
          description: "Email observed in public profile metadata",
        });
        if (!emailNodeId) continue;
        discoveredEmails.add(email);
        emailRecords += 1;
      }

      for (const website of result.value.websites || []) {
        const websiteNodeId = addWebsiteNodeToGraph(graph, {
          url: website.url,
          fromId: candidateId,
          relation: "related_website",
          source: website.source || "identity_probe",
          sourceUrl: website.url,
          confidence: Number.isFinite(website.confidence) ? website.confidence : 0.75,
          description: "Website linked from public profile metadata",
        });
        if (!websiteNodeId) continue;
        websiteRecords += 1;
        const websiteDomain = normalizeDomain(website.url);
        if (websiteDomain) {
          domains.add(websiteDomain);
          graph.addNode({
            id: `domain:${websiteDomain}`,
            type: "domain",
            label: websiteDomain,
            source: website.source || "identity_probe",
            url: `https://${websiteDomain}`,
          });
          graph.addEdge({
            from: websiteNodeId,
            to: `domain:${websiteDomain}`,
            relation: "website_domain",
            source: website.source || "identity_probe",
            sourceUrl: website.url,
            confidence: 0.78,
          });
        }
      }
    }

    sourceStatus.push(
      buildSourceStatus(
        "username_candidates",
        "Username Candidate Expansion",
        probeFailures > 0 && profileRecords === 0 ? "partial" : "ok",
        candidateNodes,
        "",
        ""
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "username_identity_probes",
        "Username Identity Probes",
        probeFailures > 0 && profileRecords === 0 ? "partial" : "ok",
        profileRecords,
        probeFailures > 0 ? `${probeFailures} probe checks returned no response` : "",
        "https://github.com/"
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "username_email_website",
        "Username Email/Website Links",
        "ok",
        emailRecords + websiteRecords,
        "",
        ""
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "slack",
        "Slack Accounts",
        "skipped",
        0,
        "Slack identities are workspace-scoped and not globally enumerable from public internet."
      )
    );

    timeline.finish(
      usernameStage,
      probeFailures > 0 && profileRecords === 0 ? "partial" : "ok",
      candidateNodes + profileRecords + emailRecords + websiteRecords,
      probeFailures > 0 ? `${probeFailures} probe checks did not return` : ""
    );
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "username_candidates",
        "Username Candidate Expansion",
        "skipped",
        0,
        "No username candidates detected from query"
      )
    );
    sourceStatus.push(
      buildSourceStatus(
        "slack",
        "Slack Accounts",
        "skipped",
        0,
        "Slack identities are workspace-scoped and not globally enumerable from public internet."
      )
    );
    timeline.finish(usernameStage, "skipped", 0, "No username candidates resolved from seed");
  }

  const entityStage = timeline.start(
    "entity_search",
    "Entity Search",
    "Query Wikidata, Wikipedia, and GitHub search index"
  );
  const [wikidataSettled, wikipediaSettled, githubSettled] = await Promise.allSettled([
    searchWikidataEntities(query),
    searchWikipedia(query),
    searchGithubUsers(query),
  ]);
  let entityStageRecords = 0;

  if (wikidataSettled.status === "fulfilled") {
    const entities = wikidataSettled.value.filter((entry) => entry.id && entry.label);
    sourceStatus.push(
      buildSourceStatus(
        "wikidata",
        "Wikidata Entities",
        "ok",
        entities.length,
        "",
        "https://www.wikidata.org/wiki/Wikidata:Main_Page"
      )
    );

    for (const entity of entities) {
      const entityId = `wikidata:${entity.id}`;
      graph.addNode({
        id: entityId,
        type: "entity",
        label: entity.label,
        description: entity.description,
        source: "wikidata",
        url: entity.conceptUri,
        evidence: [
          {
            source: "wikidata",
            url: entity.conceptUri,
            label: "Entity page",
          },
        ],
      });
      graph.addEdge({
        from: rootId,
        to: entityId,
        relation: "matched_entity",
        source: "wikidata",
        sourceUrl: entity.conceptUri,
        confidence: 0.84,
      });
    }

    const detailCandidates = entities.slice(0, MAX_WIKIDATA_DETAILS);
    const detailSettled = await Promise.allSettled(
      detailCandidates.map((entity) => fetchWikidataEntityDetails(entity.id))
    );

    let detailRecords = 0;
    let detailErrors = 0;

    for (let i = 0; i < detailSettled.length; i += 1) {
      const current = detailSettled[i];
      const entity = detailCandidates[i];
      if (current.status !== "fulfilled") {
        detailErrors += 1;
        continue;
      }

      const entityNodeId = `wikidata:${entity.id}`;
      const { websites, profiles } = current.value;

      for (const website of websites) {
        detailRecords += 1;
        domains.add(website.domain);
        const domainNodeId = `domain:${website.domain}`;
        graph.addNode({
          id: domainNodeId,
          type: "domain",
          label: website.domain,
          source: "wikidata",
          url: website.url,
          evidence: [
            {
              source: "wikidata",
              url: website.url,
              label: "Wikidata website claim",
            },
          ],
        });
        graph.addEdge({
          from: entityNodeId,
          to: domainNodeId,
          relation: "official_website",
          source: "wikidata",
          sourceUrl: website.url,
          confidence: 0.93,
        });
      }

      for (const profile of profiles) {
        const added = addProfileNodeToGraph(graph, {
          ...profile,
          fromId: entityNodeId,
          source: "wikidata",
          sourceUrl: `https://www.wikidata.org/wiki/${entity.id}`,
          confidence: 0.88,
        });
        if (added) detailRecords += 1;
      }
    }

    const detailStatus = detailErrors === 0 ? "ok" : detailRecords > 0 ? "partial" : "failed";
    const detailErrorMessage = detailErrors > 0 ? `${detailErrors} detail lookups failed` : "";

    sourceStatus.push(
      buildSourceStatus(
        "wikidata_details",
        "Wikidata Entity Details",
        detailStatus,
        detailRecords,
        detailErrorMessage,
        "https://www.wikidata.org/wiki/Wikidata:Data_access"
      )
    );
    entityStageRecords += entities.length + detailRecords;
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "wikidata",
        "Wikidata Entities",
        "failed",
        0,
        wikidataSettled.reason?.message || "Wikidata search failed",
        "https://www.wikidata.org/wiki/Wikidata:Data_access"
      )
    );
  }

  if (wikipediaSettled.status === "fulfilled") {
    const references = wikipediaSettled.value.filter((entry) => entry.pageId && entry.title);
    sourceStatus.push(
      buildSourceStatus(
        "wikipedia",
        "Wikipedia",
        "ok",
        references.length,
        "",
        "https://www.wikipedia.org/"
      )
    );

    for (const reference of references) {
      const articleNodeId = `wikipedia:${reference.pageId}`;
      const articleUrl = `https://en.wikipedia.org/?curid=${reference.pageId}`;
      graph.addNode({
        id: articleNodeId,
        type: "knowledge_article",
        label: reference.title,
        description: reference.snippet,
        source: "wikipedia",
        url: articleUrl,
        evidence: [
          {
            source: "wikipedia",
            url: articleUrl,
            label: "Wikipedia article",
          },
        ],
      });
      graph.addEdge({
        from: rootId,
        to: articleNodeId,
        relation: "knowledge_reference",
        source: "wikipedia",
        sourceUrl: articleUrl,
        confidence: 0.72,
      });
    }
    entityStageRecords += references.length;
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "wikipedia",
        "Wikipedia",
        "failed",
        0,
        wikipediaSettled.reason?.message || "Wikipedia search failed",
        "https://www.wikipedia.org/"
      )
    );
  }

  if (githubSettled.status === "fulfilled") {
    const profiles = githubSettled.value.filter((entry) => entry.login);
    sourceStatus.push(
      buildSourceStatus(
        "github",
        "GitHub Profiles",
        "ok",
        profiles.length,
        "",
        "https://docs.github.com/en/rest/search"
      )
    );

    for (const profile of profiles) {
      const added = addProfileNodeToGraph(graph, {
        fromId: rootId,
        platform: "github",
        relation: "public_code_identity",
        handle: profile.login,
        url: profile.profileUrl,
        source: "github_search",
        sourceUrl: profile.profileUrl,
        confidence: Math.max(0.45, Math.min(0.85, profile.score / 100)),
        description: profile.type ? `Account type: ${profile.type}` : "",
      });
      if (!added) continue;
    }
    entityStageRecords += profiles.length;
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "github",
        "GitHub Profiles",
        "failed",
        0,
        githubSettled.reason?.message || "GitHub search failed",
        "https://docs.github.com/en/rest/search"
      )
    );
  }
  timeline.finish(entityStage, "ok", entityStageRecords, "Entity correlation completed");

  const domainCandidates = Array.from(domains).slice(0, MAX_DOMAIN_CERT_LOOKUPS);
  const domainStage = timeline.start(
    "domain_intel",
    "Domain Infrastructure Intel",
    "Expand domain seed into DNS, RDAP, and certificate graph"
  );

  if (domainCandidates.length > 0) {
    let crtRecords = 0;
    let dnsRecords = 0;
    let rdapRecords = 0;
    let crtErrors = 0;
    let dnsErrors = 0;
    let rdapErrors = 0;

    const domainIntelSettled = await Promise.allSettled(
      domainCandidates.map(async (domain) => {
        const [crtSubdomains, dnsIntel, rdapIntel] = await Promise.all([
          fetchCertificateSubdomains(domain),
          fetchDomainDnsIntel(domain),
          fetchDomainRdapIntel(domain),
        ]);
        return { domain, crtSubdomains, dnsIntel, rdapIntel };
      })
    );

    for (const domainResult of domainIntelSettled) {
      if (domainResult.status !== "fulfilled") {
        crtErrors += 1;
        dnsErrors += 1;
        rdapErrors += 1;
        continue;
      }

      const { domain, crtSubdomains, dnsIntel, rdapIntel } = domainResult.value;
      const domainNodeId = `domain:${domain}`;

      if (Array.isArray(crtSubdomains)) {
        for (const subdomain of crtSubdomains) {
          if (!subdomain || subdomain === domain) continue;
          crtRecords += 1;
          const subdomainNodeId = `subdomain:${subdomain}`;
          graph.addNode({
            id: subdomainNodeId,
            type: "subdomain",
            label: subdomain,
            source: "crtsh",
            url: `https://${subdomain}`,
            evidence: [
              {
                source: "crtsh",
                url: `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}`,
                label: "crt.sh certificate records",
              },
            ],
          });
          graph.addEdge({
            from: domainNodeId,
            to: subdomainNodeId,
            relation: "certificate_observed",
            source: "crtsh",
            sourceUrl: `https://crt.sh/?q=${encodeURIComponent(`%.${domain}`)}`,
            confidence: 0.74,
          });
        }
      } else {
        crtErrors += 1;
      }

      if (dnsIntel?.records) {
        dnsErrors += Number(dnsIntel?.failures || 0);

        for (const ip of dnsIntel.records.A || []) {
          dnsRecords += 1;
          const ipNodeId = `ip:${ip}`;
          graph.addNode({
            id: ipNodeId,
            type: "ip",
            label: ip,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: ipNodeId,
            relation: "dns_a_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
            confidence: 0.91,
          });
        }

        for (const ipv6 of dnsIntel.records.AAAA || []) {
          dnsRecords += 1;
          const ipNodeId = `ip:${ipv6}`;
          graph.addNode({
            id: ipNodeId,
            type: "ip",
            label: ipv6,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: ipNodeId,
            relation: "dns_aaaa_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=AAAA`,
            confidence: 0.9,
          });
        }

        for (const mxHost of dnsIntel.records.MX || []) {
          dnsRecords += 1;
          const mxNodeId = `mx:${toSafeIdFragment(mxHost)}`;
          graph.addNode({
            id: mxNodeId,
            type: "mx_host",
            label: mxHost,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: mxNodeId,
            relation: "dns_mx_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=MX`,
            confidence: 0.9,
          });
        }

        for (const nsHost of dnsIntel.records.NS || []) {
          dnsRecords += 1;
          const nsNodeId = `nameserver:${toSafeIdFragment(nsHost)}`;
          graph.addNode({
            id: nsNodeId,
            type: "nameserver",
            label: nsHost,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: nsNodeId,
            relation: "dns_ns_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=NS`,
            confidence: 0.9,
          });
        }

        for (const txt of dnsIntel.records.TXT || []) {
          dnsRecords += 1;
          const txtNodeId = `txt:${domain}:${hashText(txt)}`;
          graph.addNode({
            id: txtNodeId,
            type: "dns_txt",
            label: truncateText(txt, 96),
            description: txt,
            source: "dns_google",
          });
          graph.addEdge({
            from: domainNodeId,
            to: txtNodeId,
            relation: "dns_txt_record",
            source: "dns_google",
            sourceUrl: `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=TXT`,
            confidence: 0.88,
          });
        }
      } else {
        dnsErrors += 1;
      }

      if (rdapIntel) {
        if (rdapIntel.registrarName) {
          rdapRecords += 1;
          const registrarId = `registrar:${toSafeIdFragment(rdapIntel.registrarName)}`;
          graph.addNode({
            id: registrarId,
            type: "registrar",
            label: rdapIntel.registrarName,
            source: "rdap",
          });
          graph.addEdge({
            from: domainNodeId,
            to: registrarId,
            relation: "domain_registrar",
            source: "rdap",
            sourceUrl: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
            confidence: 0.93,
          });
        }

        for (const nsHost of rdapIntel.nameservers || []) {
          rdapRecords += 1;
          const nsNodeId = `nameserver:${toSafeIdFragment(nsHost)}`;
          graph.addNode({
            id: nsNodeId,
            type: "nameserver",
            label: nsHost,
            source: "rdap",
          });
          graph.addEdge({
            from: domainNodeId,
            to: nsNodeId,
            relation: "rdap_nameserver",
            source: "rdap",
            sourceUrl: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
            confidence: 0.92,
          });
        }

        for (const status of rdapIntel.statuses || []) {
          rdapRecords += 1;
          const statusNodeId = `rdap-status:${toSafeIdFragment(status)}`;
          graph.addNode({
            id: statusNodeId,
            type: "rdap_status",
            label: status,
            source: "rdap",
          });
          graph.addEdge({
            from: domainNodeId,
            to: statusNodeId,
            relation: "rdap_status",
            source: "rdap",
            sourceUrl: `https://rdap.org/domain/${encodeURIComponent(domain)}`,
            confidence: 0.87,
          });
        }
      } else {
        rdapErrors += 1;
      }
    }

    sourceStatus.push(
      buildSourceStatus(
        "crtsh",
        "Certificate Transparency",
        crtErrors > 0 && crtRecords === 0 ? "partial" : "ok",
        crtRecords,
        crtErrors > 0 ? `${crtErrors} domain lookups returned no certificate data` : "",
        "https://crt.sh/"
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "dns_google",
        "DNS Intelligence",
        dnsErrors > 0 && dnsRecords === 0 ? "partial" : "ok",
        dnsRecords,
        dnsErrors > 0 ? `${dnsErrors} DNS record queries returned no response` : "",
        "https://dns.google/"
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "rdap",
        "RDAP Registration",
        rdapErrors > 0 && rdapRecords === 0 ? "partial" : "ok",
        rdapRecords,
        rdapErrors > 0 ? `${rdapErrors} RDAP lookups returned no response` : "",
        "https://rdap.org/"
      )
    );
    timeline.finish(
      domainStage,
      "ok",
      crtRecords + dnsRecords + rdapRecords,
      `Expanded ${domainCandidates.length} domain seeds`
    );
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "crtsh",
        "Certificate Transparency",
        "skipped",
        0,
        "No domain candidates resolved from input or related entities",
        "https://crt.sh/"
      )
    );
    sourceStatus.push(
      buildSourceStatus(
        "dns_google",
        "DNS Intelligence",
        "skipped",
        0,
        "No domain candidates available for DNS graph expansion",
        "https://dns.google/"
      )
    );
    sourceStatus.push(
      buildSourceStatus(
        "rdap",
        "RDAP Registration",
        "skipped",
        0,
        "No domain candidates available for RDAP expansion",
        "https://rdap.org/"
      )
    );
    timeline.finish(domainStage, "skipped", 0, "No domain candidates to expand");
  }

  const emailStage = timeline.start(
    "email_gravatar",
    "Email + Gravatar Expansion",
    "Derive email graph and probe Gravatar identity profiles"
  );

  const inferredEmailCandidates = generateEmailCandidates(
    query,
    queryType,
    usernameCandidates,
    Array.from(domains)
  );
  const candidateEmails = Array.from(
    new Set([...Array.from(discoveredEmails), ...inferredEmailCandidates])
  ).slice(0, MAX_EMAIL_CANDIDATES);
  let emailCandidateRecords = 0;
  let gravatarRecords = 0;
  let gravatarFailures = 0;

  for (const email of candidateEmails) {
    const emailNodeId = addEmailNodeToGraph(graph, {
      email,
      fromId: rootId,
      relation: queryType === "email" && email === normalizedQueryEmail ? "input_email" : "email_candidate",
      source: email === normalizedQueryEmail ? "user_input" : "email_inference",
      sourceUrl: "",
      confidence: email === normalizedQueryEmail ? 1 : 0.45,
      description:
        email === normalizedQueryEmail
          ? "Input email seed"
          : "Inferred email alias from username/domain expansion",
    });
    if (!emailNodeId) continue;
    discoveredEmails.add(email);
    emailCandidateRecords += 1;
  }

  const gravatarProbeEmails = Array.from(discoveredEmails).slice(0, MAX_GRAVATAR_PROBES);
  const gravatarSettled = await Promise.allSettled(
    gravatarProbeEmails.map((email) => fetchGravatarByEmail(email))
  );

  for (let i = 0; i < gravatarSettled.length; i += 1) {
    const result = gravatarSettled[i];
    if (result.status !== "fulfilled") {
      gravatarFailures += 1;
      continue;
    }
    if (!result.value) continue;

    const emailNodeId = `email:${result.value.email}`;
    const gravatarNodeId = addGravatarNodeToGraph(graph, {
      ...result.value,
      fromId: emailNodeId,
      source: "gravatar",
      confidence: 0.91,
    });
    if (!gravatarNodeId) continue;
    gravatarRecords += 1;

    for (const websiteUrl of result.value.relatedUrls || []) {
      const websiteNodeId = addWebsiteNodeToGraph(graph, {
        url: websiteUrl,
        fromId: gravatarNodeId,
        relation: "gravatar_website",
        source: "gravatar",
        sourceUrl: result.value.sourceUrl,
        confidence: 0.83,
        description: "Website linked from Gravatar profile",
      });
      if (!websiteNodeId) continue;
      const domain = normalizeDomain(websiteUrl);
      if (domain) domains.add(domain);
    }
  }

  sourceStatus.push(
    buildSourceStatus(
      "email_expansion",
      "Email Candidate Expansion",
      candidateEmails.length > 0 ? "ok" : "skipped",
      emailCandidateRecords,
      candidateEmails.length > 0 ? "" : "No email seed could be inferred from the current query"
    )
  );
  sourceStatus.push(
    buildSourceStatus(
      "gravatar",
      "Gravatar Profiles",
      gravatarFailures > 0 && gravatarRecords === 0 ? "partial" : "ok",
      gravatarRecords,
      gravatarFailures > 0 ? `${gravatarFailures} gravatar lookups timed out or failed` : "",
      "https://gravatar.com/"
    )
  );

  timeline.finish(
    emailStage,
    candidateEmails.length > 0 ? "ok" : "skipped",
    emailCandidateRecords + gravatarRecords,
    candidateEmails.length > 0
      ? `Expanded ${candidateEmails.length} email candidates`
      : "No email candidate available for gravatar expansion"
  );

  const graphData = graph.toJson();

  if (graphData.edges.length === 0 && usernameCandidates.length > 0) {
    const fallbackHandle = usernameCandidates[0];
    const fallbackNodeId = `username:${fallbackHandle}`;
    graph.addNode({
      id: fallbackNodeId,
      type: "username",
      label: `@${fallbackHandle}`,
      handle: fallbackHandle,
      source: "heuristic",
      evidence: [
        {
          source: "heuristic",
          label: "Fallback username candidate",
        },
      ],
    });
    graph.addEdge({
      from: rootId,
      to: fallbackNodeId,
      relation: "username_candidate",
      source: "heuristic",
      confidence: 0.58,
    });
  }

  const finalGraph = graph.toJson();
  const profileCount = finalGraph.nodes.filter((node) => node.type === "profile").length;
  const domainCount = finalGraph.nodes.filter((node) =>
    ["domain", "subdomain", "website"].includes(node.type)
  ).length;
  const emailCount = finalGraph.nodes.filter((node) => node.type === "email").length;
  const gravatarCount = finalGraph.nodes.filter((node) => node.type === "gravatar").length;
  const healthySources = sourceStatus.filter((entry) => entry.status === "ok").length;

  return {
    query,
    queryType,
    generatedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Date.now() - startedAt),
    connectivity,
    graph: finalGraph,
    sources: sourceStatus,
    timeline: timeline.toJson(),
    summary: {
      nodes: finalGraph.nodes.length,
      edges: finalGraph.edges.length,
      profiles: profileCount,
      emails: emailCount,
      gravatarProfiles: gravatarCount,
      digitalFootprint: domainCount,
      sourceHealth: `${healthySources}/${sourceStatus.length}`,
    },
  };
};

const truncateText = (text = "", maxLen = 120) => {
  const value = cleanWhitespace(text);
  if (!value || value.length <= maxLen) return value;
  return `${value.slice(0, Math.max(0, maxLen - 1)).trimEnd()}…`;
};

export default buildPublicIntelGraph;
