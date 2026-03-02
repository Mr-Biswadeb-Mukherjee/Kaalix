// Modules/captcha.js
import { createCanvas } from "canvas";
import { randomInt, randomUUID } from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { getOrInitRedisClient } from "../Connectors/Redis.js";

// Use Redis for captcha storage
const REDIS_CAPTCHA_PREFIX = "captcha:";
const REDIS_FORM_NONCE_PREFIX = "auth:form-nonce:";
const REDIS_CAPTCHA_NONCE_PREFIX = "auth:captcha-nonce:";
const REDIS_FORM_ACTIVE_CAPTCHA_ID_PREFIX = "auth:form-active-captcha-id:";
const REDIS_FORM_ACTIVE_CAPTCHA_NONCE_PREFIX = "auth:form-active-captcha-nonce:";
export const AUTH_CHALLENGE_TTL_SECONDS = 60;

/**
 * Render captcha image + text
 * @param {number} difficulty Difficulty level (0-10)
 */
function renderCaptcha(difficulty = 5) {
  const width = 160;
  const height = 60;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // ✅ Dynamic character length
  const length = Math.min(4 + Math.floor(difficulty / 2), 8);

  // ✅ Generate random text
  const text = Array.from({ length }, () => randomBase36Char()).join("");

  const id = uuidv4();

  // ✅ Background: gradient for higher difficulty
  if (difficulty > 5) {
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, randomColor());
    gradient.addColorStop(1, randomColor());
    ctx.fillStyle = gradient;
  } else {
    ctx.fillStyle = "#f0f0f0";
  }
  ctx.fillRect(0, 0, width, height);

  // ✅ Add noise lines based on difficulty
  for (let i = 0; i < difficulty * 2; i++) {
    ctx.strokeStyle = randomColor(0.5);
    ctx.beginPath();
    ctx.moveTo(randomFloat() * width, randomFloat() * height);
    ctx.lineTo(randomFloat() * width, randomFloat() * height);
    ctx.stroke();
  }

  // ✅ Draw captcha text
  const baseFontSize = 26 + difficulty * 1.5;
  const fonts = ["Arial", "Courier", "Georgia", "Verdana", "Tahoma"];
  const letterSpacing = width / (length + 1);

  for (let i = 0; i < length; i++) {
    const char = text.charAt(i);
    const fontFamily = fonts.at(randomInt(fonts.length)) ?? fonts[0];
    const font = `${baseFontSize}px ${fontFamily}`;
    ctx.font = font;

    ctx.save();

    const x = (i + 0.5) * letterSpacing;
    const y = height / 2 + baseFontSize / 3;

    const angle = (randomFloat() - 0.5) * (0.4 + difficulty * 0.05);
    ctx.translate(x, y);
    ctx.rotate(angle);

    ctx.fillStyle = difficulty > 5 ? randomColor() : "#333";

    const jitterX = difficulty > 6 ? randomFloat() * 4 - 2 : 0;
    const jitterY = difficulty > 6 ? randomFloat() * 4 - 2 : 0;

    ctx.fillText(char, jitterX, jitterY);
    ctx.restore();
  }

  // ✅ Random dots/noise
  const noiseCount = 10 + difficulty * 10;
  for (let i = 0; i < noiseCount; i++) {
    ctx.fillStyle = randomColor(randomFloat());
    ctx.beginPath();
    ctx.arc(randomFloat() * width, randomFloat() * height, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  return {
    id,
    image: canvas.toDataURL(),
    text,
  };
}

async function rotateCaptchaForForm(formNonce, difficulty = 5) {
  const redis = await getOrInitRedisClient();
  const formNonceKey = `${REDIS_FORM_NONCE_PREFIX}${formNonce}`;
  const formActiveCaptchaIdKey = `${REDIS_FORM_ACTIVE_CAPTCHA_ID_PREFIX}${formNonce}`;
  const formActiveCaptchaNonceKey = `${REDIS_FORM_ACTIVE_CAPTCHA_NONCE_PREFIX}${formNonce}`;

  const formTtlSeconds = await redis.ttl(formNonceKey);
  if (!Number.isInteger(formTtlSeconds) || formTtlSeconds <= 0) {
    return {
      ok: false,
      code: "FORM_NONCE_EXPIRED",
      message: "Login form expired. Reload the page to continue.",
    };
  }

  const [oldCaptchaId, oldCaptchaNonce] = await redis
    .multi()
    .get(formActiveCaptchaIdKey)
    .get(formActiveCaptchaNonceKey)
    .exec();

  const keysToDelete = [];
  if (typeof oldCaptchaId === "string" && oldCaptchaId) {
    keysToDelete.push(`${REDIS_CAPTCHA_PREFIX}${oldCaptchaId}`);
  }
  if (typeof oldCaptchaNonce === "string" && oldCaptchaNonce) {
    keysToDelete.push(`${REDIS_CAPTCHA_NONCE_PREFIX}${oldCaptchaNonce}`);
  }

  if (keysToDelete.length > 0) {
    await redis.del(...keysToDelete);
  }

  const { id, image, text } = renderCaptcha(difficulty);
  const captchaNonce = randomUUID();
  const ttlSeconds = formTtlSeconds;
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

  const captchaKey = `${REDIS_CAPTCHA_PREFIX}${id}`;
  const captchaNonceKey = `${REDIS_CAPTCHA_NONCE_PREFIX}${captchaNonce}`;
  const nonceBinding = `${formNonce}:${id}`;

  await redis
    .multi()
    .setEx(captchaKey, ttlSeconds, text)
    .setEx(captchaNonceKey, ttlSeconds, nonceBinding)
    .setEx(formActiveCaptchaIdKey, ttlSeconds, id)
    .setEx(formActiveCaptchaNonceKey, ttlSeconds, captchaNonce)
    .exec();

  return {
    ok: true,
    id,
    image,
    captchaNonce,
    expiresAt,
    ttlSeconds,
  };
}

/**
 * Create a new form challenge. Form nonce is fixed for this form lifespan.
 */
export const generateCaptcha = async (difficulty = 5) => {
  const redis = await getOrInitRedisClient();
  const formNonce = randomUUID();
  const formNonceKey = `${REDIS_FORM_NONCE_PREFIX}${formNonce}`;

  await redis.setEx(formNonceKey, AUTH_CHALLENGE_TTL_SECONDS, "active");

  const challenge = await rotateCaptchaForForm(formNonce, difficulty);
  if (!challenge.ok) {
    return challenge;
  }

  return {
    ...challenge,
    formNonce,
  };
};

/**
 * Refresh only captcha challenge for an existing form nonce.
 */
export const refreshCaptcha = async (formNonce, difficulty = 5) => {
  const normalizedFormNonce =
    typeof formNonce === "string" ? formNonce.trim() : "";

  if (!normalizedFormNonce) {
    return {
      ok: false,
      code: "FORM_NONCE_REQUIRED",
      message: "Form token is required to refresh captcha.",
    };
  }

  const challenge = await rotateCaptchaForForm(normalizedFormNonce, difficulty);
  if (!challenge.ok) {
    return challenge;
  }

  return {
    ...challenge,
    formNonce: normalizedFormNonce,
  };
};

/**
 * Verify one-time captcha challenge bound to a persistent form nonce.
 * @returns {Promise<{ok: boolean, code?: string, message?: string}>}
 */
export async function verifyCaptchaChallenge({
  formNonce,
  captchaNonce,
  captchaId,
  userInput,
}) {
  const redis = await getOrInitRedisClient();
  const formNonceKey = `${REDIS_FORM_NONCE_PREFIX}${formNonce}`;
  const formActiveCaptchaIdKey = `${REDIS_FORM_ACTIVE_CAPTCHA_ID_PREFIX}${formNonce}`;
  const formActiveCaptchaNonceKey = `${REDIS_FORM_ACTIVE_CAPTCHA_NONCE_PREFIX}${formNonce}`;
  const captchaNonceKey = `${REDIS_CAPTCHA_NONCE_PREFIX}${captchaNonce}`;
  const captchaKey = `${REDIS_CAPTCHA_PREFIX}${captchaId}`;

  const replies = await redis
    .multi()
    .exists(formNonceKey)
    .get(formActiveCaptchaIdKey)
    .get(formActiveCaptchaNonceKey)
    .get(captchaNonceKey)
    .get(captchaKey)
    .exec();

  const [formExists, activeCaptchaId, activeCaptchaNonce, nonceBinding, storedCaptchaText] =
    Array.isArray(replies) ? replies : [0, null, null, null, null];

  if (Number(formExists) !== 1) {
    return {
      ok: false,
      code: "FORM_NONCE_EXPIRED",
      message: "Login form expired. Reload the page to continue.",
    };
  }

  if (!activeCaptchaId || !activeCaptchaNonce) {
    return {
      ok: false,
      code: "CAPTCHA_EXPIRED",
      message: "Captcha challenge expired. Refresh captcha and try again.",
    };
  }

  if (activeCaptchaId !== captchaId || activeCaptchaNonce !== captchaNonce) {
    return {
      ok: false,
      code: "CHALLENGE_MISMATCH",
      message: "Captcha challenge mismatch detected. Refresh and try again.",
    };
  }

  if (nonceBinding !== `${formNonce}:${captchaId}`) {
    return {
      ok: false,
      code: "CHALLENGE_MISMATCH",
      message: "Captcha challenge mismatch detected. Refresh and try again.",
    };
  }

  if (!storedCaptchaText) {
    await redis.del(captchaNonceKey, formActiveCaptchaIdKey, formActiveCaptchaNonceKey);
    return {
      ok: false,
      code: "CAPTCHA_EXPIRED",
      message: "Captcha expired. Refresh captcha and try again.",
    };
  }

  // Captcha challenge is one-time. Keep form nonce valid until its own TTL.
  await redis.del(captchaKey, captchaNonceKey, formActiveCaptchaIdKey, formActiveCaptchaNonceKey);

  if (storedCaptchaText === userInput) {
    return { ok: true };
  }

  if (
    typeof userInput === "string" &&
    storedCaptchaText.toLowerCase() === userInput.toLowerCase()
  ) {
    return {
      ok: false,
      code: "CAPTCHA_CASE_MISMATCH",
      message: "Captcha is case-sensitive. Please enter it exactly as shown.",
    };
  }

  return {
    ok: false,
    code: "CAPTCHA_INVALID",
    message: "Captcha verification failed. Please try again.",
  };
}

/**
 * Get stored captcha text (for debug/logging)
 */
export async function getStoredCaptcha(id) {
  const redis = await getOrInitRedisClient();
  const captchaKey = `${REDIS_CAPTCHA_PREFIX}${id}`;
  return redis.get(captchaKey);
}

/**
 * Random color generator
 */
function randomColor(alpha = 1) {
  const r = randomInt(150) + 50;
  const g = randomInt(150) + 50;
  const b = randomInt(150) + 50;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function randomFloat() {
  return randomInt(0x1_0000_0000) / 0x1_0000_0000;
}

function randomBase36Char() {
  return randomInt(36).toString(36).toUpperCase();
}

export default {
  generateCaptcha,
  refreshCaptcha,
  verifyCaptchaChallenge,
  getStoredCaptcha,
};
