import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "url";
import { LoggerContainer } from "../Logger/Logger.js";

const logger = LoggerContainer.get("BootstrapCredentials");
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ROOT_LOGS_DIR = path.join(PROJECT_ROOT, "Logs");
const LEGACY_LOGS_DIR = path.join(PROJECT_ROOT, "backend", "Logs");

const DEFAULT_BOOTSTRAP_FILE = path.join(
  ROOT_LOGS_DIR,
  "bootstrap-sa-credentials.json"
);

const DEFAULT_BOOTSTRAP_SEAL_FILE = path.join(
  ROOT_LOGS_DIR,
  ".bootstrap-sa-sealed.json"
);

const LEGACY_BOOTSTRAP_FILE = path.join(
  LEGACY_LOGS_DIR,
  "bootstrap-sa-credentials.json"
);

const isTruthy = (value) => {
  const normalized = String(value ?? "").trim().toLowerCase();
  return ["1", "true", "yes", "on"].includes(normalized);
};

const writeJsonFileSecure = (filePath, payload) => {
  const data = Buffer.from(`${JSON.stringify(payload, null, 2)}\n`, "utf8");
  const fd = fs.openSync(filePath, "w", 0o600);

  try {
    fs.writeSync(fd, data, 0, data.length, 0);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }

  fs.chmodSync(filePath, 0o600);
};

const normalizeBootstrapPath = (candidatePath) => {
  const resolvedPath = path.resolve(candidatePath);
  const normalizedLegacyDir = path.normalize(LEGACY_LOGS_DIR);
  const normalizedResolved = path.normalize(resolvedPath);

  if (
    normalizedResolved === normalizedLegacyDir ||
    normalizedResolved.startsWith(`${normalizedLegacyDir}${path.sep}`)
  ) {
    const relativePath = path.relative(normalizedLegacyDir, normalizedResolved);
    return path.resolve(ROOT_LOGS_DIR, relativePath || "bootstrap-sa-credentials.json");
  }

  return resolvedPath;
};

export const getBootstrapCredentialsFilePath = () => {
  const configuredPath = String(process.env.SA_BOOTSTRAP_CREDENTIALS_FILE || "").trim();
  const rawPath = configuredPath
    ? (path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(PROJECT_ROOT, configuredPath))
    : DEFAULT_BOOTSTRAP_FILE;
  return normalizeBootstrapPath(rawPath);
};

export const getBootstrapSealFilePath = () => {
  const configuredPath = String(process.env.SA_BOOTSTRAP_SEAL_FILE || "").trim();
  const rawPath = configuredPath
    ? (path.isAbsolute(configuredPath)
      ? configuredPath
      : path.resolve(PROJECT_ROOT, configuredPath))
    : DEFAULT_BOOTSTRAP_SEAL_FILE;
  return normalizeBootstrapPath(rawPath);
};

export const isBootstrapSealed = () => {
  const sealPath = getBootstrapSealFilePath();
  return fs.existsSync(sealPath);
};

export const isBootstrapReseedForced = () =>
  isTruthy(process.env.SA_BOOTSTRAP_FORCE_RESEED);

export const markBootstrapSealed = ({ reason = "onboarding-complete" } = {}) => {
  const sealPath = getBootstrapSealFilePath();
  const payload = {
    sealed_at: new Date().toISOString(),
    reason,
    note:
      "Bootstrap SA credential generation is sealed. Set SA_BOOTSTRAP_FORCE_RESEED=1 to bypass this lock once.",
  };

  if (fs.existsSync(sealPath)) {
    return true;
  }

  try {
    fs.mkdirSync(path.dirname(sealPath), { recursive: true });
    writeJsonFileSecure(sealPath, payload);
    logger.warn(`🔒 Bootstrap SA seed sealed at ${sealPath}`);
    return true;
  } catch (err) {
    logger.error(`❌ Failed to write bootstrap SA seal file: ${err.message}`);
    return false;
  }
};

export const writeBootstrapCredentialsFile = ({
  userId,
  username,
  email,
  password,
}) => {
  const filePath = getBootstrapCredentialsFilePath();
  const payload = {
    generated_at: new Date().toISOString(),
    user_id: userId,
    username,
    email,
    password,
    note:
      "Use these one-time bootstrap credentials to login, change password, and complete profile setup. This file is auto-deleted after setup.",
  };

  try {
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeJsonFileSecure(filePath, payload);

    logger.warn(`🔐 Bootstrap SA credentials saved to ${filePath}`);
    console.warn(`[BOOTSTRAP] SA credentials file created at: ${filePath}`);
    return filePath;
  } catch (err) {
    logger.error(`❌ Failed to write bootstrap SA credentials file: ${err.message}`);
    return null;
  }
};

export const deleteBootstrapCredentialsFile = () => {
  const wipeAndDelete = (filePath) => {
    if (!fs.existsSync(filePath)) return false;

    try {
      const stats = fs.statSync(filePath);
      if (stats.isFile() && stats.size > 0) {
        // Best-effort wipe before deletion for one-time bootstrap secrets.
        const fd = fs.openSync(filePath, "r+");
        try {
          const randomData = crypto.randomBytes(stats.size);
          fs.writeSync(fd, randomData, 0, randomData.length, 0);
          fs.fsyncSync(fd);
        } finally {
          fs.closeSync(fd);
        }
      }

      fs.rmSync(filePath, { force: true });
      logger.warn(`🧹 Bootstrap SA credentials file removed: ${filePath}`);
      return true;
    } catch (err) {
      logger.error(`❌ Failed to delete bootstrap SA credentials file: ${err.message}`);
      return false;
    }
  };

  const primaryPath = getBootstrapCredentialsFilePath();
  const legacyPath = path.resolve(LEGACY_BOOTSTRAP_FILE);
  const candidatePaths = [primaryPath];
  if (!candidatePaths.includes(legacyPath)) {
    candidatePaths.push(legacyPath);
  }

  let deletedAny = false;
  for (const filePath of candidatePaths) {
    if (wipeAndDelete(filePath)) {
      deletedAny = true;
    }
  }

  return deletedAny;
};

export const maybeDeleteBootstrapCredentialsFile = ({ role, onboarding }) => {
  if (role !== "sa") return false;

  const mustChangePassword = Boolean(onboarding?.mustChangePassword);
  const mustUpdateProfile = Boolean(onboarding?.mustUpdateProfile);
  const mustShareLocation = Boolean(onboarding?.mustShareLocation);
  const required =
    typeof onboarding?.required === "boolean"
      ? onboarding.required
      : (mustChangePassword || mustUpdateProfile || mustShareLocation);

  if (required) {
    return false;
  }

  const removed = deleteBootstrapCredentialsFile();
  const sealed = markBootstrapSealed({ reason: "sa-onboarding-completed" });
  return removed || sealed;
};
