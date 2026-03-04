import {
  NOTIFICATION_CHANNELS,
  getNotificationInboxSnapshot,
  getUnreadNotificationCount,
  markAllNotificationsRead,
  markNotificationRead,
} from "../Services/notification.service.js";

const parseLimit = (rawLimit) => {
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed)) return 12;
  if (parsed < 1) return 1;
  if (parsed > 50) return 50;
  return parsed;
};

const parseChannel = (rawChannel) => {
  const normalized = typeof rawChannel === "string" ? rawChannel.trim().toLowerCase() : "";
  if (normalized === NOTIFICATION_CHANNELS.REGULAR) return NOTIFICATION_CHANNELS.REGULAR;
  if (normalized === NOTIFICATION_CHANNELS.INTELLIGENCE) return NOTIFICATION_CHANNELS.INTELLIGENCE;
  return NOTIFICATION_CHANNELS.ALL;
};

export const FetchNotifications = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const snapshot = await getNotificationInboxSnapshot({
      userId,
      limit: parseLimit(req.query?.limit),
    });

    return res.status(200).json({
      success: true,
      ...snapshot,
    });
  } catch (err) {
    console.error("Error in FetchNotifications:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch notifications.",
      code: "NOTIFICATIONS_FETCH_FAILED",
    });
  }
};

export const FetchUnreadNotificationCount = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const channel = parseChannel(req.query?.channel);
    const unreadCount = await getUnreadNotificationCount(userId, { channel });

    return res.status(200).json({
      success: true,
      channel,
      unreadCount,
    });
  } catch (err) {
    console.error("Error in FetchUnreadNotificationCount:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch unread notification count.",
      code: "NOTIFICATION_COUNT_FETCH_FAILED",
    });
  }
};

export const MarkNotificationRead = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const notificationId =
      typeof req.body?.notificationId === "string" ? req.body.notificationId.trim() : "";

    if (!notificationId) {
      return res.status(400).json({
        success: false,
        message: "notificationId is required.",
        code: "NOTIFICATION_ID_REQUIRED",
      });
    }

    const result = await markNotificationRead({ userId, notificationId });

    if (!result.found) {
      return res.status(404).json({
        success: false,
        message: "Notification not found.",
        code: "NOTIFICATION_NOT_FOUND",
      });
    }

    const [unreadCount, intelligenceUnreadCount, regularUnreadCount] = await Promise.all([
      getUnreadNotificationCount(userId, {
        channel: NOTIFICATION_CHANNELS.ALL,
      }),
      getUnreadNotificationCount(userId, {
        channel: NOTIFICATION_CHANNELS.INTELLIGENCE,
      }),
      getUnreadNotificationCount(userId, {
        channel: NOTIFICATION_CHANNELS.REGULAR,
      }),
    ]);

    return res.status(200).json({
      success: true,
      updated: result.updated,
      alreadyRead: result.alreadyRead,
      unreadCount,
      unreadCounts: {
        all: unreadCount,
        intelligence: intelligenceUnreadCount,
        regular: regularUnreadCount,
      },
    });
  } catch (err) {
    console.error("Error in MarkNotificationRead:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update notification state.",
      code: "NOTIFICATION_UPDATE_FAILED",
    });
  }
};

export const MarkAllNotificationsRead = async (req, res) => {
  try {
    const userId = req.user?.user_id;
    const updated = await markAllNotificationsRead(userId);

    return res.status(200).json({
      success: true,
      updated,
      unreadCount: 0,
      unreadCounts: {
        all: 0,
        intelligence: 0,
        regular: 0,
      },
    });
  } catch (err) {
    console.error("Error in MarkAllNotificationsRead:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to mark notifications as read.",
      code: "NOTIFICATIONS_MARK_ALL_FAILED",
    });
  }
};
