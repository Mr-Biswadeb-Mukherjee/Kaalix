import { createHash } from "node:crypto";
import {
  MAX_DNS_VALUES_PER_TYPE,
  MAX_GITHUB_RESULTS,
  MAX_RDAP_NAMESERVERS,
  MAX_SUBDOMAINS_PER_DOMAIN,
  MAX_WIKIDATA_RESULTS,
  MAX_WIKIPEDIA_RESULTS,
  SOCIAL_PROPERTY_MAP,
} from "./constants.js";
import { fetchJson, fetchOptionalJson, fetchWithTimeout } from "./http.js";
import {
  cleanWhitespace,
  normalizeDomain,
  normalizeEmail,
  normalizeHandle,
  normalizeWebsiteUrl,
  stripHtml,
} from "./normalization.js";

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

export const searchWikidataEntities = async (query) => {
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

export const fetchWikidataEntityDetails = async (entityId) => {
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

export const searchWikipedia = async (query) => {
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

export const searchGithubUsers = async (query) => {
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

export const fetchCertificateSubdomains = async (domain) => {
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

export const fetchDomainDnsIntel = async (domain) => {
  const recordTypes = ["A", "AAAA", "MX", "NS", "TXT"];

  const settled = await Promise.allSettled(recordTypes.map((type) => resolveDnsRecordType(domain, type)));

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

export const fetchDomainRdapIntel = async (domain) => {
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

export const fetchGravatarByEmail = async (email) => {
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
