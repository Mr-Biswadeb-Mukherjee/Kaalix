// Modules/captcha.js
import { createCanvas } from "canvas";
import { v4 as uuidv4 } from "uuid";
import { initRedis, getRedisClient } from "../Connectors/Redis.js";

/**
 * Generate a captcha with adjustable difficulty (0 = easy, 10 = hard)
 * @param {number} difficulty Difficulty level (0-10)
 */
export const generateCaptcha = (difficulty = 6) => {
  const width = 160;
  const height = 60;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // ✅ Dynamic character length
  const length = Math.min(4 + Math.floor(difficulty / 2), 8);

  // ✅ Generate random text
  const text = Array.from({ length }, () =>
    Math.random().toString(36).charAt(2).toUpperCase()
  ).join("");

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
    ctx.moveTo(Math.random() * width, Math.random() * height);
    ctx.lineTo(Math.random() * width, Math.random() * height);
    ctx.stroke();
  }

  // ✅ Draw captcha text
  const baseFontSize = 26 + difficulty * 1.5;
  const fonts = ["Arial", "Courier", "Georgia", "Verdana", "Tahoma"];
  const letterSpacing = width / (length + 1);

  for (let i = 0; i < length; i++) {
    const char = text[i];
    const font = `${baseFontSize}px ${fonts[Math.floor(Math.random() * fonts.length)]}`;
    ctx.font = font;

    ctx.save();

    // Positioning
    const x = (i + 0.5) * letterSpacing;
    const y = height / 2 + baseFontSize / 3;

    // ✅ Rotation per letter
    const angle = (Math.random() - 0.5) * (0.4 + difficulty * 0.05);
    ctx.translate(x, y);
    ctx.rotate(angle);

    // ✅ Random color per letter for higher difficulty
    ctx.fillStyle = difficulty > 5 ? randomColor() : "#333";

    // ✅ Slight position jitter at high difficulty
    const jitterX = difficulty > 6 ? Math.random() * 4 - 2 : 0;
    const jitterY = difficulty > 6 ? Math.random() * 4 - 2 : 0;

    ctx.fillText(char, jitterX, jitterY);
    ctx.restore();
  }

  // ✅ Random dots/noise
  const noiseCount = 10 + difficulty * 10;
  for (let i = 0; i < noiseCount; i++) {
    ctx.fillStyle = randomColor(Math.random());
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 1.5, 0, Math.PI * 2);
    ctx.fill();
  }

  // Store captcha in memory
  const image = canvas.toDataURL();
  
  // Store captcha in Redis with a 5-minute expiry
  // Ensure Redis is initialized before using it
  initRedis().then(() => {
    const redisClient = getRedisClient();
    redisClient.set(`captcha:${id}`, text, { EX: 5 * 60 }); // 5 minutes expiry
  }).catch(err => {
    console.error("Failed to store captcha in Redis:", err);
    // Fallback to in-memory store if Redis fails (optional, but good for resilience)
    // For now, we'll just log the error and not store it if Redis is down.
  });

  return { id, image };
};

/**
 * Strict verification
 */
export async function verifyCaptcha(id, userInput) {
  const redisClient = getRedisClient();
  const stored = await redisClient.get(`captcha:${id}`);
  
  if (!stored) return false;
  
  const isValid = stored === userInput;
  if (isValid) captchaStore.delete(id); // One-time use
  return isValid;
}

/**
 * Get stored captcha text (for debug/logging)
 */
export async function getStoredCaptcha(id) {
  const redisClient = getRedisClient();
  const stored = await redisClient.get(`captcha:${id}`);
  return stored;
}

/**
 * Random color generator
 */
function randomColor(alpha = 1) {
  const r = Math.floor(Math.random() * 150 + 50);
  const g = Math.floor(Math.random() * 150 + 50);
  const b = Math.floor(Math.random() * 150 + 50);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
