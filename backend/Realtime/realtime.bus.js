import { EventEmitter } from "node:events";

const bus = new EventEmitter();
const NOTIFICATIONS_CHANGED_EVENT = "notifications.changed";

export const emitNotificationsChanged = (userId) => {
  if (typeof userId !== "string" || !userId.trim()) return;
  bus.emit(NOTIFICATIONS_CHANGED_EVENT, userId.trim());
};

export const onNotificationsChanged = (handler) => {
  if (typeof handler !== "function") {
    return () => {};
  }

  bus.on(NOTIFICATIONS_CHANGED_EVENT, handler);

  return () => {
    bus.off(NOTIFICATIONS_CHANGED_EVENT, handler);
  };
};
