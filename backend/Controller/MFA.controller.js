import { MFAService } from "../Services/MFA.service.js";
import { createNotificationSafely } from "../Services/notification.service.js";
import {
  recordUserActivitySafely,
  USER_ACTIVITY_TYPES,
} from "../Services/userActivity.service.js";

const asPromise = (value) => Promise.resolve(value);
const normalizeText = (value) =>
  typeof value === "string" ? value.trim() : "";

const resolveRequestIpAddress = (req) => {
  const forwardedFor = normalizeText(req.get("x-forwarded-for"));
  if (forwardedFor) {
    const firstForwardedAddress = forwardedFor.split(",")[0]?.trim();
    if (firstForwardedAddress) return firstForwardedAddress;
  }

  const directIp = normalizeText(req.ip);
  if (directIp) return directIp;

  return normalizeText(req.socket?.remoteAddress) || null;
};

export const GetMFAStatus = async (req, res) => {
  const userId = req.user.user_id;
  const status = await asPromise(MFAService.getStatus(userId));
  return res.status(200).json({ success: true, status });
};

export const ToggleMFA = async (req, res) => {
  const userId = req.user.user_id;
  const { method, action } = req.body;

  if (!method || !["setup", "disable"].includes(action)) {
    return res.status(400).json({ success: false, message: "Invalid request" });
  }

  try {
    if (action === "setup") {
      const result = await asPromise(MFAService.toggle(userId, method));
      return res.status(200).json({ success: true, ...result });
    }

    await asPromise(MFAService.disable(userId, method));
    await createNotificationSafely({
      userId,
      actorUserId: userId,
      type: "security.mfa_disabled",
      severity: "warning",
      title: "MFA Disabled",
      message: `${method.toUpperCase()} multi-factor authentication was disabled.`,
      metadata: { method },
    });
    await recordUserActivitySafely({
      userId,
      activityType: USER_ACTIVITY_TYPES.MFA_DISABLED,
      title: "MFA disabled",
      description: `${method.toUpperCase()} multi-factor authentication was disabled.`,
      ipAddress: resolveRequestIpAddress(req),
      userAgent: normalizeText(req.get("user-agent")) || null,
      metadata: { method },
    });
    return res.status(200).json({ success: true, message: `${method} disabled` });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};

export const VerifyMFA = async (req, res) => {
  const userId = req.user.user_id;
  const { method, token } = req.body;

  if (!method || !token) {
    return res.status(400).json({ success: false, message: "Missing method or token" });
  }

  try {
    await asPromise(MFAService.verify(userId, method, token));
    await createNotificationSafely({
      userId,
      actorUserId: userId,
      type: "security.mfa_enabled",
      severity: "success",
      title: "MFA Enabled",
      message: `${method.toUpperCase()} multi-factor authentication is now enabled.`,
      metadata: { method },
    });
    await recordUserActivitySafely({
      userId,
      activityType: USER_ACTIVITY_TYPES.MFA_ENABLED,
      title: "MFA enabled",
      description: `${method.toUpperCase()} multi-factor authentication is now enabled.`,
      ipAddress: resolveRequestIpAddress(req),
      userAgent: normalizeText(req.get("user-agent")) || null,
      metadata: { method },
    });
    return res.status(200).json({ success: true, message: "MFA verified and enabled" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
