export const GRAPH_VIEW_WIDTH = 1400;
export const GRAPH_VIEW_HEIGHT = 760;
export const GRAPH_CENTER_X = GRAPH_VIEW_WIDTH / 2;
export const GRAPH_CENTER_Y = GRAPH_VIEW_HEIGHT / 2;
export const GRAPH_DEFAULT_PAN = { x: GRAPH_CENTER_X, y: GRAPH_CENTER_Y };
export const GRAPH_MIN_ZOOM = 0.35;
export const GRAPH_MAX_ZOOM = 2.8;
export const GRAPH_ZOOM_STEP = 0.2;

export const clampNumber = (value, min, max) => Math.min(max, Math.max(min, value));

export const formatDateTime = (value) => {
  if (!value) return "Unknown";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "Unknown";
  return parsed.toLocaleString();
};

export const truncateLabel = (value, max = 22) => {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "unknown";
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
};

export const getNodeColor = (type) => {
  switch (String(type || "").toLowerCase()) {
    case "profile":
    case "username":
      return "#4f46e5";
    case "email":
      return "#0ea5e9";
    case "domain":
    case "website":
    case "subdomain":
      return "#16a34a";
    case "gravatar":
      return "#9333ea";
    case "individual":
      return "#d97706";
    default:
      return "#64748b";
  }
};

export const getStatusClass = (status) => {
  if (status === "ok") return "ok";
  if (status === "partial") return "partial";
  return "failed";
};

export const getStatusLabel = (status) => {
  if (status === "ok") return "ok";
  if (status === "partial") return "partial";
  return "failed";
};

export const resolveRootNodeId = (nodes) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return "";
  const userSeed = nodes.find((node) => node?.source === "user_input");
  if (userSeed?.id) return userSeed.id;
  const targetSeed = nodes.find((node) => typeof node?.id === "string" && node.id.startsWith("target:"));
  if (targetSeed?.id) return targetSeed.id;
  return String(nodes[0]?.id || "");
};

export const buildNodeLayout = (nodes, edges) => {
  if (!Array.isArray(nodes) || nodes.length === 0) return [];

  const sanitizedNodes = nodes.filter((node) => typeof node?.id === "string" && node.id.trim());
  if (sanitizedNodes.length === 0) return [];

  const nodeById = new Map(sanitizedNodes.map((node) => [node.id, node]));
  const adjacency = new Map();
  for (const node of sanitizedNodes) adjacency.set(node.id, new Set());

  if (Array.isArray(edges)) {
    for (const edge of edges) {
      const from = String(edge?.from || "");
      const to = String(edge?.to || "");
      if (!from || !to || !adjacency.has(from) || !adjacency.has(to)) continue;
      adjacency.get(from).add(to);
      adjacency.get(to).add(from);
    }
  }

  const rootId = resolveRootNodeId(sanitizedNodes);
  const queue = rootId ? [rootId] : [];
  const levelById = new Map();
  if (rootId) levelById.set(rootId, 0);

  while (queue.length > 0) {
    const current = queue.shift();
    const currentLevel = levelById.get(current) || 0;
    const neighbors = adjacency.get(current) || new Set();
    for (const next of neighbors) {
      if (levelById.has(next)) continue;
      levelById.set(next, currentLevel + 1);
      queue.push(next);
    }
  }

  const disconnected = sanitizedNodes
    .map((node) => node.id)
    .filter((id) => !levelById.has(id))
    .sort((a, b) => a.localeCompare(b));
  const maxLevel = Math.max(0, ...Array.from(levelById.values()));
  disconnected.forEach((id, index) => {
    levelById.set(id, maxLevel + 1 + Math.floor(index / 12));
  });

  const idsByLevel = new Map();
  for (const [id, level] of levelById.entries()) {
    if (!idsByLevel.has(level)) idsByLevel.set(level, []);
    idsByLevel.get(level).push(id);
  }

  const positioned = [];
  const levels = Array.from(idsByLevel.keys()).sort((a, b) => a - b);
  for (const level of levels) {
    const levelIds = idsByLevel.get(level).sort((a, b) => a.localeCompare(b));
    if (level === 0 && levelIds.length > 0) {
      const rootNode = nodeById.get(levelIds[0]);
      if (rootNode) {
        positioned.push({ ...rootNode, x: 0, y: 0, radius: 26 });
      }
      continue;
    }

    const radius = 160 + level * 120;
    const count = levelIds.length;
    const angleStep = (2 * Math.PI) / Math.max(1, count);
    const angleOffset = level % 2 === 0 ? Math.PI / 8 : Math.PI / 4;

    levelIds.forEach((id, index) => {
      const angle = angleOffset + index * angleStep;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * (radius * 0.72);
      const node = nodeById.get(id);
      if (!node) return;
      positioned.push({
        ...node,
        x,
        y,
        radius: id === rootId ? 26 : 20,
      });
    });
  }

  return positioned;
};
