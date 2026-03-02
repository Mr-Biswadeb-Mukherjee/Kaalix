import { URL } from "node:url";
import { WebSocketServer } from "ws";
import API from "@amon/shared";
import { verifyToken } from "../Utils/JWT.utils.js";
import getSystemStats from "../Services/status.service.js";
import { getMonitoringSnapshot } from "../Middleware/APILogger.middleware.js";
import {
  getUnreadNotificationCount,
  listNotifications,
} from "../Services/notification.service.js";
import { onNotificationsChanged } from "./realtime.bus.js";

const HEARTBEAT_INTERVAL_MS = 30000;
const SYSTEM_PUSH_INTERVAL_MS = 1000;
const NOTIFICATION_SNAPSHOT_LIMIT = 15;

const normalizeToken = (value) =>
  typeof value === "string" ? value.trim() : "";

const normalizePath = (value = "") => {
  const trimmed = String(value || "").trim();
  return trimmed ? trimmed.replace(/\/+$/, "") : "";
};

const sendJson = (ws, payload) => {
  if (!ws || ws.readyState !== 1) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // swallow send errors for disconnected peers
  }
};

const closeUnauthorizedUpgrade = (socket) => {
  try {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
  } catch {
    // ignore socket write failures
  }
  socket.destroy();
};

const attachClient = (clientMap, userId, ws) => {
  if (!clientMap.has(userId)) {
    clientMap.set(userId, new Set());
  }
  clientMap.get(userId).add(ws);
};

const detachClient = (clientMap, userId, ws) => {
  const userSockets = clientMap.get(userId);
  if (!userSockets) return;
  userSockets.delete(ws);
  if (userSockets.size === 0) {
    clientMap.delete(userId);
  }
};

const initializeClientLifecycle = (ws) => {
  ws.isAlive = true;
  ws.on("pong", () => {
    ws.isAlive = true;
  });
};

const buildRealtimeConnectionPayload = async (userId) => {
  const [notifications, unreadCount] = await Promise.all([
    listNotifications({ userId, limit: NOTIFICATION_SNAPSHOT_LIMIT }),
    getUnreadNotificationCount(userId),
  ]);

  return {
    type: "realtime.connected",
    connectedAt: new Date().toISOString(),
    stats: getSystemStats(),
    monitoring: getMonitoringSnapshot(),
    notifications,
    unreadCount,
  };
};

export const initializeRealtimeGateway = (server) => {
  const wsPath = normalizePath(API.system.protected.realtime.endpoint);
  const wss = new WebSocketServer({ noServer: true });
  const clientsByUserId = new Map();

  const sendNotificationSnapshotToUser = async (userId) => {
    const userSockets = clientsByUserId.get(userId);
    if (!userSockets || userSockets.size === 0) return;

    const [notifications, unreadCount] = await Promise.all([
      listNotifications({ userId, limit: NOTIFICATION_SNAPSHOT_LIMIT }),
      getUnreadNotificationCount(userId),
    ]);

    const payload = {
      type: "notifications.snapshot",
      notifications,
      unreadCount,
      emittedAt: new Date().toISOString(),
    };

    for (const socket of userSockets) {
      sendJson(socket, payload);
    }
  };

  const unsubscribeNotificationsChanged = onNotificationsChanged((userId) => {
    void sendNotificationSnapshotToUser(userId);
  });

  wss.on("connection", async (ws, request, authPayload) => {
    void request;
    const userId = authPayload?.user_id;
    if (!userId) {
      ws.close(1008, "Unauthorized");
      return;
    }

    ws.userId = userId;
    attachClient(clientsByUserId, userId, ws);
    initializeClientLifecycle(ws);

    try {
      const initialPayload = await buildRealtimeConnectionPayload(userId);
      sendJson(ws, initialPayload);
    } catch (err) {
      sendJson(ws, {
        type: "realtime.error",
        message: err?.message || "Failed to initialize realtime session.",
      });
    }

    ws.on("close", () => {
      detachClient(clientsByUserId, userId, ws);
    });
    ws.on("message", (rawMessage) => {
      let payload;
      try {
        payload = JSON.parse(String(rawMessage || ""));
      } catch {
        return;
      }

      if (payload?.type === "notifications.refresh") {
        void sendNotificationSnapshotToUser(userId);
      }
    });
  });

  server.on("upgrade", async (request, socket, head) => {
    let parsedUrl;
    try {
      parsedUrl = new URL(request.url || "", "http://localhost");
    } catch {
      closeUnauthorizedUpgrade(socket);
      return;
    }

    const requestPath = normalizePath(parsedUrl.pathname);
    if (requestPath !== wsPath) {
      socket.destroy();
      return;
    }

    const token = normalizeToken(parsedUrl.searchParams.get("token"));
    if (!token) {
      closeUnauthorizedUpgrade(socket);
      return;
    }

    try {
      const payload = await verifyToken(token, { revoke: false });

      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit("connection", ws, request, payload);
      });
    } catch {
      closeUnauthorizedUpgrade(socket);
    }
  });

  const heartbeatInterval = setInterval(() => {
    for (const client of wss.clients) {
      if (client.isAlive === false) {
        client.terminate();
        continue;
      }

      client.isAlive = false;
      client.ping();
    }
  }, HEARTBEAT_INTERVAL_MS);

  const systemStatsPushInterval = setInterval(() => {
    const monitoring = getMonitoringSnapshot();

    const payload = {
      type: "system.stats",
      emittedAt: new Date().toISOString(),
      stats: getSystemStats(),
      monitoring,
    };

    for (const client of wss.clients) {
      sendJson(client, payload);
    }
  }, SYSTEM_PUSH_INTERVAL_MS);

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
    clearInterval(systemStatsPushInterval);
    unsubscribeNotificationsChanged();
  });

  server.on("close", () => {
    try {
      wss.close();
    } catch {
      // ignore close errors
    }
  });

  return wss;
};
