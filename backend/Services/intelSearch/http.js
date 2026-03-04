import fetch from "node-fetch";
import { DEFAULT_HTTP_TIMEOUT_MS } from "./constants.js";

export const createHttpError = (status, message, code) => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  return err;
};

export const fetchWithTimeout = async (url, options = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        "User-Agent": "KaaliX-Intel-Graph/1.0",
        ...(options?.headers || {}),
      },
    });
  } finally {
    clearTimeout(timer);
  }
};

export const fetchJson = async (url, options = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) => {
  const response = await fetchWithTimeout(url, options, timeoutMs);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status} from ${url}`);
  }
  return response.json();
};

export const fetchOptionalJson = async (url, options = {}, timeoutMs = DEFAULT_HTTP_TIMEOUT_MS) => {
  try {
    const response = await fetchWithTimeout(url, options, timeoutMs);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
};
