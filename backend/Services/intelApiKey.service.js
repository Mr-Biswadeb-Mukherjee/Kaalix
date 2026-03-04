import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const DEFAULT_KEY_FILE = path.resolve(PROJECT_ROOT, "Logs", ".intel", "serpapi.key");

const MIN_KEY_LENGTH = 20;
const MAX_KEY_LENGTH = 256;

const resolveKeyFilePath = () => {
  const configured = typeof process.env.INTEL_SERPAPI_KEY_FILE === "string"
    ? process.env.INTEL_SERPAPI_KEY_FILE.trim()
    : "";
  if (!configured) return DEFAULT_KEY_FILE;
  return path.isAbsolute(configured) ? configured : path.resolve(PROJECT_ROOT, configured);
};

const normalizeKey = (value) => (typeof value === "string" ? value.trim() : "");

const assertValidKey = (value) => {
  const key = normalizeKey(value);
  if (!key) {
    const err = new Error("SerpAPI key is required.");
    err.status = 400;
    err.code = "INTEL_API_KEY_REQUIRED";
    throw err;
  }
  if (key.length < MIN_KEY_LENGTH || key.length > MAX_KEY_LENGTH) {
    const err = new Error(
      `SerpAPI key length must be between ${MIN_KEY_LENGTH} and ${MAX_KEY_LENGTH} characters.`
    );
    err.status = 400;
    err.code = "INTEL_API_KEY_INVALID";
    throw err;
  }
  return key;
};

const safeReadKeyFile = async () => {
  const keyPath = resolveKeyFilePath();
  try {
    const raw = await fs.readFile(keyPath, "utf8");
    return normalizeKey(raw);
  } catch (err) {
    if (err?.code === "ENOENT") return "";
    throw err;
  }
};

const maskKey = (key) => {
  const normalized = normalizeKey(key);
  if (!normalized) return "";
  if (normalized.length <= 8) return `${normalized.slice(0, 2)}***`;
  return `${normalized.slice(0, 4)}...${normalized.slice(-4)}`;
};

export const getIntelApiKeyStatus = async () => {
  const envKey = normalizeKey(process.env.SERPAPI_KEY);
  if (envKey) {
    return {
      configured: true,
      source: "env",
      maskedKey: maskKey(envKey),
    };
  }

  const fileKey = await safeReadKeyFile();
  if (fileKey) {
    return {
      configured: true,
      source: "file",
      maskedKey: maskKey(fileKey),
    };
  }

  return {
    configured: false,
    source: "none",
    maskedKey: "",
  };
};

export const getActiveSerpApiKey = async () => {
  const envKey = normalizeKey(process.env.SERPAPI_KEY);
  if (envKey) return envKey;
  const fileKey = await safeReadKeyFile();
  return fileKey || "";
};

export const saveSerpApiKey = async (rawKey) => {
  const key = assertValidKey(rawKey);
  const keyPath = resolveKeyFilePath();
  const keyDir = path.dirname(keyPath);

  await fs.mkdir(keyDir, { recursive: true, mode: 0o700 });
  await fs.writeFile(keyPath, `${key}\n`, { mode: 0o600 });
  await fs.chmod(keyPath, 0o600);

  process.env.SERPAPI_KEY = key;

  return {
    configured: true,
    source: "file",
    maskedKey: maskKey(key),
    keyPath,
  };
};

export const clearSerpApiKey = async () => {
  const keyPath = resolveKeyFilePath();
  try {
    await fs.unlink(keyPath);
  } catch (err) {
    if (err?.code !== "ENOENT") throw err;
  }

  delete process.env.SERPAPI_KEY;

  return {
    configured: false,
    source: "none",
    maskedKey: "",
    keyPath,
  };
};

export default {
  getIntelApiKeyStatus,
  getActiveSerpApiKey,
  saveSerpApiKey,
  clearSerpApiKey,
};
