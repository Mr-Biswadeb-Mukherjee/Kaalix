// Modules/captcha.js

import { createCanvas } from "canvas";
import { v4 as uuidv4 } from "uuid";

// ✅ In-memory store (for development only)
const captchaStore = new Map();

// ✅ Generate a new captcha image and ID
export const generateCaptcha = () => {
  const width = 150;
  const height = 50;
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  const text = Math.random().toString(36).substring(2, 6).toUpperCase();
  const id = uuidv4();

  // Draw background
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0, 0, width, height);

  // Draw captcha text
  ctx.font = "30px Arial";
  ctx.fillStyle = "#333";
  ctx.rotate((Math.random() - 0.5) * 0.2);
  ctx.fillText(text, 25 + Math.random() * 10, 35 + Math.random() * 5);

  // Add random noise
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = `rgba(0,0,0,${Math.random()})`;
    ctx.beginPath();
    ctx.arc(Math.random() * width, Math.random() * height, 1.5, 0, 2 * Math.PI);
    ctx.fill();
  }

  const image = canvas.toDataURL();
  captchaStore.set(id, text);

  // Auto-expire in 5 minutes
  setTimeout(() => captchaStore.delete(id), 5 * 60 * 1000);

  return { id, image };
};

// ✅ Strict verification
export function verifyCaptcha(id, userInput) {
  const stored = captchaStore.get(id);
  if (!stored) return false;

  const isValid = stored === userInput;
  if (isValid) captchaStore.delete(id); // One-time use
  return isValid;
}

// ✅ Helper for future Redis compatibility
export function getStoredCaptcha(id) {
  return captchaStore.get(id);
}
