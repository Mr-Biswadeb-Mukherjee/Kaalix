import { MFAService } from "../Services/MFA.service.js";

export const GetMFAStatus = async (req, res) => {
  const userId = req.user.user_id;
  const status = await MFAService.getStatus(userId);
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
      const result = await MFAService.toggle(userId, method);
      return res.status(200).json({ success: true, ...result });
    }

    await MFAService.disable(userId, method);
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
    await MFAService.verify(userId, method, token);
    return res.status(200).json({ success: true, message: "MFA verified and enabled" });
  } catch (err) {
    return res.status(400).json({ success: false, message: err.message });
  }
};
