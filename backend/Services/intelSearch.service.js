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
const domainPattern =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

const cleanWhitespace = (value = "") =>
  String(value || "")
    .replace(/\s+/g, " ")
    .trim();

const stripHtml = (value = "") => cleanWhitespace(String(value || "").replace(/<[^>]*>/g, " "));

const removeWwwPrefix = (hostname = "") =>
  hostname.startsWith("www.") ? hostname.slice(4) : hostname;

const normalizeHandle = (value = "") => String(value || "").trim().replace(/^@+/, "");

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

  return candidates.slice(0, MAX_USERNAME_CANDIDATES);
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
  const data = await fetchOptionalJson(
    `https://api.github.com/users/${encodeURIComponent(username)}`,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    },
    USERNAME_PROBE_TIMEOUT_MS
  );
  if (!data?.login) return null;

  return {
    platform: "github",
    relation: "github_account",
    handle: cleanWhitespace(data.login),
    url: cleanWhitespace(data.html_url || `https://github.com/${username}`),
    description: cleanWhitespace(data.bio || data.type || "GitHub profile"),
    confidence: 0.96,
    source: "github_exact",
  };
};

const probeRedditUsername = async (username) => {
  const data = await fetchOptionalJson(
    `https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
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
  };
};

const probeHackerNewsUsername = async (username) => {
  const data = await fetchOptionalJson(
    `https://hacker-news.firebaseio.com/v0/user/${encodeURIComponent(username)}.json`,
    {},
    USERNAME_PROBE_TIMEOUT_MS
  );
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
  };
};

const probeKeybaseUsername = async (username) => {
  const data = await fetchOptionalJson(
    `https://keybase.io/_/api/1.0/user/lookup.json?username=${encodeURIComponent(username)}`,
    {},
    USERNAME_PROBE_TIMEOUT_MS
  );

  const profile = Array.isArray(data?.them) ? data.them[0] : null;
  const handle = cleanWhitespace(profile?.basics?.username || "");
  if (!handle) return null;

  return {
    platform: "keybase",
    relation: "keybase_account",
    handle,
    url: `https://keybase.io/${encodeURIComponent(handle)}`,
    description: cleanWhitespace(profile?.profile?.full_name || "Keybase account"),
    confidence: 0.92,
    source: "keybase_exact",
  };
};

const probeUsernameCandidate = async (username) => {
  const probes = [
    probeGithubUsername(username),
    probeRedditUsername(username),
    probeHackerNewsUsername(username),
    probeKeybaseUsername(username),
  ];

  const settled = await Promise.allSettled(probes);
  const profiles = [];
  let failures = 0;

  for (const result of settled) {
    if (result.status === "fulfilled") {
      if (result.value) profiles.push(result.value);
      continue;
    }
    failures += 1;
  }

  return {
    username,
    profiles,
    failures,
    probes: settled.length,
  };
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
    });
  };

  const addEdge = (edge) => {
    if (!edge?.from || !edge?.to || !edge?.relation) return;
    const key = `${edge.from}|${edge.to}|${edge.relation}`;
    if (edges.has(key)) return;
    edges.set(key, {
      id: key,
      ...edge,
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
  });

  graph.addEdge({
    from: input?.fromId,
    to: nodeId,
    relation,
    source: input?.source || "public_data",
    confidence: typeof input?.confidence === "number" ? input.confidence : 0.8,
  });

  return true;
};

const buildSourceStatus = (id, label, status, records, error = "") => ({
  id,
  label,
  status,
  records: Number.isFinite(records) ? records : 0,
  error: cleanWhitespace(error),
});

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
  const domains = new Set();
  const queryType = inferQueryType(query);
  const rootId = `target:${query.toLowerCase()}`;
  const startedAt = Date.now();

  graph.addNode({
    id: rootId,
    type: queryType,
    label: query,
    source: "user_input",
    confidence: 1,
  });

  const inputDomain = normalizeDomain(query);
  if (inputDomain) {
    domains.add(inputDomain);
    graph.addNode({
      id: `domain:${inputDomain}`,
      type: "domain",
      label: inputDomain,
      source: "user_input",
      url: `https://${inputDomain}`,
    });
    graph.addEdge({
      from: rootId,
      to: `domain:${inputDomain}`,
      relation: "input_domain",
      source: "user_input",
      confidence: 1,
    });
  }

  const usernameCandidates = generateUsernameCandidates(query, queryType);
  if (usernameCandidates.length > 0) {
    const probeResults = await Promise.allSettled(
      usernameCandidates.map((candidate) => probeUsernameCandidate(candidate))
    );

    let candidateNodes = 0;
    let profileRecords = 0;
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
      });

      graph.addEdge({
        from: rootId,
        to: candidateId,
        relation: "username_candidate",
        source: "heuristic",
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
    }

    sourceStatus.push(
      buildSourceStatus(
        "username_candidates",
        "Username Candidate Expansion",
        probeFailures > 0 && profileRecords === 0 ? "partial" : "ok",
        candidateNodes
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "username_identity_probes",
        "Username Identity Probes",
        probeFailures > 0 && profileRecords === 0 ? "partial" : "ok",
        profileRecords,
        probeFailures > 0 ? `${probeFailures} probe checks returned no response` : ""
      )
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
  }

  const [wikidataSettled, wikipediaSettled, githubSettled] = await Promise.allSettled([
    searchWikidataEntities(query),
    searchWikipedia(query),
    searchGithubUsers(query),
  ]);

  if (wikidataSettled.status === "fulfilled") {
    const entities = wikidataSettled.value.filter((entry) => entry.id && entry.label);
    sourceStatus.push(buildSourceStatus("wikidata", "Wikidata Entities", "ok", entities.length));

    for (const entity of entities) {
      const entityId = `wikidata:${entity.id}`;
      graph.addNode({
        id: entityId,
        type: "entity",
        label: entity.label,
        description: entity.description,
        source: "wikidata",
        url: entity.conceptUri,
      });
      graph.addEdge({
        from: rootId,
        to: entityId,
        relation: "matched_entity",
        source: "wikidata",
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
        });
        graph.addEdge({
          from: entityNodeId,
          to: domainNodeId,
          relation: "official_website",
          source: "wikidata",
          confidence: 0.93,
        });
      }

      for (const profile of profiles) {
        const added = addProfileNodeToGraph(graph, {
          ...profile,
          fromId: entityNodeId,
          source: "wikidata",
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
        detailErrorMessage
      )
    );
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "wikidata",
        "Wikidata Entities",
        "failed",
        0,
        wikidataSettled.reason?.message || "Wikidata search failed"
      )
    );
  }

  if (wikipediaSettled.status === "fulfilled") {
    const references = wikipediaSettled.value.filter((entry) => entry.pageId && entry.title);
    sourceStatus.push(buildSourceStatus("wikipedia", "Wikipedia", "ok", references.length));

    for (const reference of references) {
      const articleNodeId = `wikipedia:${reference.pageId}`;
      graph.addNode({
        id: articleNodeId,
        type: "knowledge_article",
        label: reference.title,
        description: reference.snippet,
        source: "wikipedia",
        url: `https://en.wikipedia.org/?curid=${reference.pageId}`,
      });
      graph.addEdge({
        from: rootId,
        to: articleNodeId,
        relation: "knowledge_reference",
        source: "wikipedia",
        confidence: 0.72,
      });
    }
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "wikipedia",
        "Wikipedia",
        "failed",
        0,
        wikipediaSettled.reason?.message || "Wikipedia search failed"
      )
    );
  }

  if (githubSettled.status === "fulfilled") {
    const profiles = githubSettled.value.filter((entry) => entry.login);
    sourceStatus.push(buildSourceStatus("github", "GitHub Profiles", "ok", profiles.length));

    for (const profile of profiles) {
      const added = addProfileNodeToGraph(graph, {
        fromId: rootId,
        platform: "github",
        relation: "public_code_identity",
        handle: profile.login,
        url: profile.profileUrl,
        source: "github_search",
        confidence: Math.max(0.45, Math.min(0.85, profile.score / 100)),
        description: profile.type ? `Account type: ${profile.type}` : "",
      });
      if (!added) continue;
    }
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "github",
        "GitHub Profiles",
        "failed",
        0,
        githubSettled.reason?.message || "GitHub search failed"
      )
    );
  }

  const domainCandidates = Array.from(domains).slice(0, MAX_DOMAIN_CERT_LOOKUPS);

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
          });
          graph.addEdge({
            from: domainNodeId,
            to: subdomainNodeId,
            relation: "certificate_observed",
            source: "crtsh",
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
        crtErrors > 0 ? `${crtErrors} domain lookups returned no certificate data` : ""
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "dns_google",
        "DNS Intelligence",
        dnsErrors > 0 && dnsRecords === 0 ? "partial" : "ok",
        dnsRecords,
        dnsErrors > 0 ? `${dnsErrors} DNS record queries returned no response` : ""
      )
    );

    sourceStatus.push(
      buildSourceStatus(
        "rdap",
        "RDAP Registration",
        rdapErrors > 0 && rdapRecords === 0 ? "partial" : "ok",
        rdapRecords,
        rdapErrors > 0 ? `${rdapErrors} RDAP lookups returned no response` : ""
      )
    );
  } else {
    sourceStatus.push(
      buildSourceStatus(
        "crtsh",
        "Certificate Transparency",
        "skipped",
        0,
        "No domain candidates resolved from input or related entities"
      )
    );
    sourceStatus.push(
      buildSourceStatus(
        "dns_google",
        "DNS Intelligence",
        "skipped",
        0,
        "No domain candidates available for DNS graph expansion"
      )
    );
    sourceStatus.push(
      buildSourceStatus(
        "rdap",
        "RDAP Registration",
        "skipped",
        0,
        "No domain candidates available for RDAP expansion"
      )
    );
  }

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
  const domainCount = finalGraph.nodes.filter(
    (node) => node.type === "domain" || node.type === "subdomain"
  ).length;
  const healthySources = sourceStatus.filter((entry) => entry.status === "ok").length;

  return {
    query,
    queryType,
    generatedAt: new Date().toISOString(),
    latencyMs: Math.max(0, Date.now() - startedAt),
    connectivity,
    graph: finalGraph,
    sources: sourceStatus,
    summary: {
      nodes: finalGraph.nodes.length,
      edges: finalGraph.edges.length,
      profiles: profileCount,
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
