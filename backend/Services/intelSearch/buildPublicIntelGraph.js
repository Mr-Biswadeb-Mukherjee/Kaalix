import { runEngineQuery } from "../intelEngine.service.js";

const MAX_QUERY_LENGTH = 120;

const cleanWhitespace = (value) => (typeof value === "string" ? value.trim() : "");

const inferQueryType = (query) => {
  if (!query) return "unknown";
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(query)) return "email";
  if (/^https?:\/\//i.test(query)) return "website";
  if (/^(?!-)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(query)) {
    return "domain";
  }
  if (query.includes(" ")) return "individual";
  return "query";
};

const inferEngineInputType = (query) => {
  const normalized = cleanWhitespace(query);
  if (/^(?=.{2,39}$)[a-z0-9](?:[a-z0-9._-]*[a-z0-9])?$/i.test(normalized)) {
    return "username";
  }
  return "query";
};

const toSafeIdFragment = (value) =>
  cleanWhitespace(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "seed";

const humanizeCollectorName = (name) =>
  cleanWhitespace(name)
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ") || "Engine Collector";

const normalizeGraphNodeType = (value) => {
  const type = cleanWhitespace(value).toLowerCase();
  if (!type) return "unknown";
  if (type === "url") return "website";
  return type;
};

const normalizeCollectorNode = ({ node, collectorName }) => {
  const id = cleanWhitespace(node?.id);
  if (!id) return null;

  const type = normalizeGraphNodeType(node?.type);
  const label = cleanWhitespace(node?.value) || id;
  const looksLikeUrl = /^https?:\/\//i.test(label);

  return {
    id,
    type,
    label,
    source: collectorName,
    url: looksLikeUrl ? label : "",
    confidence: 0.78,
    evidence: [
      {
        source: collectorName,
        label: "KaaliX engine collector record",
        url: looksLikeUrl ? label : "",
      },
    ],
  };
};

const normalizeCollectorEdge = ({ edge, collectorName }) => {
  const from = cleanWhitespace(edge?.from);
  const to = cleanWhitespace(edge?.to);
  const relation = cleanWhitespace(edge?.type).toLowerCase();
  if (!from || !to || !relation) return null;

  return {
    id: `${from}|${to}|${relation}`,
    from,
    to,
    relation,
    source: collectorName,
    confidence: 0.76,
  };
};

const upsertGraphNode = (nodeMap, node) => {
  const previous = nodeMap.get(node.id);
  if (!previous) {
    nodeMap.set(node.id, node);
    return;
  }

  const previousEvidence = Array.isArray(previous.evidence) ? previous.evidence : [];
  const incomingEvidence = Array.isArray(node.evidence) ? node.evidence : [];
  const evidence = [...previousEvidence];
  for (const entry of incomingEvidence) {
    const key = `${entry?.source || ""}|${entry?.url || ""}|${entry?.label || ""}`;
    if (evidence.some((candidate) => `${candidate?.source || ""}|${candidate?.url || ""}|${candidate?.label || ""}` === key)) {
      continue;
    }
    evidence.push(entry);
  }

  nodeMap.set(node.id, {
    ...previous,
    ...node,
    source: previous.source || node.source,
    url: previous.url || node.url,
    confidence: Math.max(Number(previous.confidence) || 0, Number(node.confidence) || 0),
    evidence: evidence.slice(0, 8),
  });
};

const upsertGraphEdge = (edgeMap, edge) => {
  const previous = edgeMap.get(edge.id);
  if (!previous) {
    edgeMap.set(edge.id, edge);
    return;
  }

  edgeMap.set(edge.id, {
    ...previous,
    ...edge,
    source: previous.source || edge.source,
    confidence: Math.max(Number(previous.confidence) || 0, Number(edge.confidence) || 0),
  });
};

export const buildPublicIntelGraph = async (rawQuery) => {
  const query = cleanWhitespace(rawQuery);
  if (!query) {
    const err = new Error("Query is required.");
    err.status = 400;
    err.code = "INTEL_QUERY_REQUIRED";
    throw err;
  }
  if (query.length < 2 || query.length > MAX_QUERY_LENGTH) {
    const err = new Error(`Query must be between 2 and ${MAX_QUERY_LENGTH} characters.`);
    err.status = 400;
    err.code = "INTEL_QUERY_INVALID";
    throw err;
  }

  const startedAt = Date.now();
  const queryType = inferQueryType(query);
  const engineInputType = inferEngineInputType(query);
  const rootId = `target:${toSafeIdFragment(query)}`;
  const engineOutput = await runEngineQuery({ query, type: engineInputType, id: rootId });
  const collectors = Array.isArray(engineOutput?.collectors) ? engineOutput.collectors : [];

  if (collectors.length === 0) {
    const err = new Error("KaaliX engine has no collector configured for this query type.");
    err.status = 503;
    err.code = "INTEL_ENGINE_NO_COLLECTORS";
    throw err;
  }

  const nodeMap = new Map();
  const edgeMap = new Map();
  const sources = [];
  const timeline = [];

  upsertGraphNode(nodeMap, {
    id: rootId,
    type: queryType,
    label: query,
    source: "user_input",
    confidence: 1,
    evidence: [
      {
        source: "user_input",
        label: "Query seed",
        url: "",
      },
    ],
  });

  for (const collectorRun of collectors) {
    const collectorName = cleanWhitespace(collectorRun?.name) || "engine_collector";
    const collectorLabel = humanizeCollectorName(collectorName);
    const status = collectorRun?.status === "ok" ? "ok" : "error";
    const collectorError = cleanWhitespace(collectorRun?.error);
    const resultNodes = Array.isArray(collectorRun?.result?.nodes) ? collectorRun.result.nodes : [];
    const resultEdges = Array.isArray(collectorRun?.result?.edges) ? collectorRun.result.edges : [];

    for (const node of resultNodes) {
      const normalizedNode = normalizeCollectorNode({ node, collectorName });
      if (!normalizedNode) continue;
      upsertGraphNode(nodeMap, normalizedNode);
    }

    for (const edge of resultEdges) {
      const normalizedEdge = normalizeCollectorEdge({ edge, collectorName });
      if (!normalizedEdge) continue;
      upsertGraphEdge(edgeMap, normalizedEdge);
    }

    const records = resultNodes.length + resultEdges.length;
    sources.push({
      id: collectorName,
      label: collectorLabel,
      status,
      records,
      error: status === "error" ? collectorError || "Collector execution failed" : "",
      url: "",
    });

    timeline.push({
      id: `collector:${collectorName}`,
      label: collectorLabel,
      status,
      records,
      detail: "Node.js plane relayed query to KaaliX Go engine collector",
      message:
        status === "ok"
          ? `Collector returned ${records} graph records`
          : collectorError || "Collector returned an error",
      durationMs: 0,
      completedAt: new Date().toISOString(),
    });
  }

  const graph = {
    nodes: Array.from(nodeMap.values()),
    edges: Array.from(edgeMap.values()),
  };

  const profileCount = graph.nodes.filter((node) => node.type === "profile").length;
  const domainCount = graph.nodes.filter((node) =>
    ["domain", "subdomain", "website"].includes(node.type)
  ).length;
  const emailCount = graph.nodes.filter((node) => node.type === "email").length;
  const gravatarCount = graph.nodes.filter((node) => node.type === "gravatar").length;
  const healthySources = sources.filter((entry) => entry.status === "ok").length;

  return {
    query,
    queryType,
    generatedAt:
      (typeof engineOutput?.generatedAt === "string" && cleanWhitespace(engineOutput.generatedAt)) ||
      new Date().toISOString(),
    latencyMs: Math.max(0, Date.now() - startedAt),
    connectivity: {
      connected: healthySources > 0,
      checks: {
        engineProcess: true,
        collectorsRegistered: collectors.length > 0,
      },
      checkedAt: new Date().toISOString(),
      latencyMs: Number.isFinite(engineOutput?.latencyMs) ? Number(engineOutput.latencyMs) : 0,
      failureReasons: healthySources > 0 ? [] : ["all_collectors_failed"],
    },
    graph,
    sources,
    timeline,
    summary: {
      nodes: graph.nodes.length,
      edges: graph.edges.length,
      profiles: profileCount,
      emails: emailCount,
      gravatarProfiles: gravatarCount,
      digitalFootprint: domainCount,
      sourceHealth: `${healthySources}/${sources.length}`,
    },
  };
};

export default buildPublicIntelGraph;
