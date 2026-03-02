import { generateCaptcha, refreshCaptcha } from "../Services/captcha.service.js";

export const GetCaptcha = async (req, res, next) => {
  try {
    const challenge = await generateCaptcha();
    if (!challenge.ok) {
      return res.status(400).json({
        success: false,
        code: challenge.code || "CAPTCHA_CHALLENGE_FAILED",
        message: challenge.message || "Unable to generate captcha challenge.",
      });
    }

    const { id, image, formNonce, captchaNonce, expiresAt, ttlSeconds } =
      challenge;
    return res
      .status(200)
      .json({ id, image, formNonce, captchaNonce, expiresAt, ttlSeconds });
  } catch (err) {
    return next(err);
  }
};

export const RefreshCaptcha = async (req, res, next) => {
  try {
    const formNonce = typeof req.body?.formNonce === "string" ? req.body.formNonce : "";
    const challenge = await refreshCaptcha(formNonce);

    if (!challenge.ok) {
      return res.status(400).json({
        success: false,
        code: challenge.code || "CAPTCHA_REFRESH_FAILED",
        message: challenge.message || "Unable to refresh captcha challenge.",
      });
    }

    const { id, image, captchaNonce, expiresAt, ttlSeconds } = challenge;
    return res.status(200).json({ id, image, captchaNonce, expiresAt, ttlSeconds });
  } catch (err) {
    return next(err);
  }
};
