import { USERNAME_PROBE_TIMEOUT_MS } from "./constants.js";
import { fetchOptionalJson, fetchWithTimeout } from "./http.js";
import {
  cleanWhitespace,
  normalizeEmail,
  normalizeHandle,
  normalizeUsername,
  normalizeWebsiteUrl,
} from "./normalization.js";

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

const uniqueStrings = (values = []) =>
  Array.from(new Set(values.map((entry) => cleanWhitespace(entry)).filter(Boolean)));

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

export const probeUsernameCandidate = async (username) => {
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
