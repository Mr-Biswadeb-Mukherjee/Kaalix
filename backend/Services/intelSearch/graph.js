import { MAX_NODE_EVIDENCE } from "./constants.js";
import {
  cleanWhitespace,
  normalizeDomain,
  normalizeEmail,
  normalizeWebsiteUrl,
  toSafeIdFragment,
} from "./normalization.js";

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

export const createGraph = () => {
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

export const addProfileNodeToGraph = (graph, input) => {
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

export const addEmailNodeToGraph = (graph, input) => {
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

export const addWebsiteNodeToGraph = (graph, input) => {
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

export const addGravatarNodeToGraph = (graph, input) => {
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

export const buildSourceStatus = (id, label, status, records, error = "", url = "") => ({
  id,
  label,
  status,
  records: Number.isFinite(records) ? records : 0,
  error: cleanWhitespace(error),
  url: cleanWhitespace(url),
});

export const createBuildTimeline = () => {
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
