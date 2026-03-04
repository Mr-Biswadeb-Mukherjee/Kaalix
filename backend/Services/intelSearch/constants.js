export const DEFAULT_HTTP_TIMEOUT_MS = 7000;
export const USERNAME_PROBE_TIMEOUT_MS = 6000;
export const MAX_QUERY_LENGTH = 120;
export const MAX_WIKIDATA_RESULTS = 5;
export const MAX_WIKIPEDIA_RESULTS = 6;
export const MAX_GITHUB_RESULTS = 6;
export const MAX_WIKIDATA_DETAILS = 4;
export const MAX_DOMAIN_CERT_LOOKUPS = 3;
export const MAX_SUBDOMAINS_PER_DOMAIN = 18;
export const MAX_USERNAME_CANDIDATES = 4;
export const MAX_DNS_VALUES_PER_TYPE = 6;
export const MAX_RDAP_NAMESERVERS = 8;
export const MAX_EMAIL_CANDIDATES = 6;
export const MAX_GRAVATAR_PROBES = 6;
export const MAX_NODE_EVIDENCE = 6;

export const SOCIAL_PROPERTY_MAP = Object.freeze([
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

export const COMPANY_HINTS = new Set([
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

export const usernamePattern = /^(?=.{2,39}$)[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i;
export const emailPattern =
  /^(?=.{6,320}$)([a-z0-9!#$%&'*+/=?^_`{|}~.-]+)@([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+)$/i;
export const domainPattern =
  /^(?=.{1,253}$)(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i;

export const COMMON_EMAIL_DOMAINS = Object.freeze([
  "gmail.com",
  "outlook.com",
  "yahoo.com",
  "icloud.com",
  "proton.me",
  "protonmail.com",
]);
