import fs from "fs";
import { promises as fsp } from "fs";
import path from "path";
import winston from "winston";
import Transport from "winston-transport";
import { Logger_key } from "../Confs/config.js";


const CHANNEL_NAME = "System Integrity Channel";
const retentionDays = 7;
const HMAC_KEY = Logger_key.HMAC_KEY;

// ==================================================================
// [1] Locate absolute project root and ensure Logs/ exists there
// ==================================================================
function findProjectRoot(startDir = process.cwd()) {
  let current = startDir;

  while (current !== path.parse(current).root) {
    const pkgPath = path.join(current, "package.json");
    const gitPath = path.join(current, ".git");

    if (fs.existsSync(pkgPath) || fs.existsSync(gitPath)) {
      return current;
    }
    current = path.dirname(current);
  }

  return startDir;
}

const projectRoot = findProjectRoot(path.resolve(process.cwd(), "../"));
const logRoot = path.join(projectRoot, "Logs");

if (!fs.existsSync(logRoot)) {
  fs.mkdirSync(logRoot, { recursive: true, mode: 0o700 });
  /*console.log(`[System Logger] Created Logs directory at: ${logRoot}`);
} else {
  console.log(`[System Logger] Using existing Logs directory at: ${logRoot}`);*/
}

// ==================================================================
// [2] Persistent per-module event counter (atomic + isolated)
// ==================================================================
const counterLocks = new Map(); // moduleName -> Promise chain
const moduleCounters = new Map(); // moduleName -> number

async function loadModuleCounter(moduleFolder, moduleName) {
  const counterFile = path.join(moduleFolder, "event-counter.json");
  try {
    const data = JSON.parse(await fsp.readFile(counterFile, "utf8"));
    moduleCounters.set(moduleName, data.lastEventId + 1);
  } catch {
    moduleCounters.set(moduleName, 1);
  }
  return counterFile;
}

async function generateSystemId(moduleName, moduleFolder) {
  if (!moduleCounters.has(moduleName)) {
    await loadModuleCounter(moduleFolder, moduleName);
  }

  // Chain sequential operations for safety
  const prev = counterLocks.get(moduleName) || Promise.resolve();

  const next = prev.then(async () => {
    const count = moduleCounters.get(moduleName);
    const id = `SYS-${moduleName.slice(0, 3).toUpperCase()}-${String(count).padStart(4, "0")}`;
    moduleCounters.set(moduleName, count + 1);
    return id;
  });

  counterLocks.set(moduleName, next);
  return next;
}

// ==================================================================
// [3] Concurrency Locks & Buffers
// ==================================================================
const logWriteLocks = new Map(); // filePath -> Promise
const logBuffers = new Map();    // filePath -> {entries: [], timer: NodeJS.Timeout|null}
const dedupCache = new Map(); // key: moduleName+message+severity, value: { lastLogTime, count }
const DEDUP_WINDOW_MS = 10_000; // 10 seconds window

async function acquireLock(filePath) {
  while (logWriteLocks.has(filePath)) {
    await logWriteLocks.get(filePath);
  }

  let release;
  const promise = new Promise((res) => (release = res));
  logWriteLocks.set(filePath, promise);
  return release;
}

function scheduleBufferFlush(filePath, delay = 2000) {
  const buf = logBuffers.get(filePath);
  if (!buf) return;
  if (buf.timer) return; // already scheduled
  buf.timer = setTimeout(() => flushBuffer(filePath), delay);
}

// ==================================================================
// [4] Buffered write + integrity hashing + counter update
// ==================================================================
async function flushBuffer(filePath) {
  const buf = logBuffers.get(filePath);
  if (!buf || buf.entries.length === 0) return;

  const entries = buf.entries.splice(0, buf.entries.length);
  clearTimeout(buf.timer);
  buf.timer = null;

  const releaseLock = await acquireLock(filePath);
  try {
    const crypto = await import("crypto");
    const dir = path.dirname(filePath);
    await fs.promises.mkdir(dir, { recursive: true, mode: 0o700 });

    const chainFile = path.join(dir, ".chainstate");
    let lastHash = "";
    try {
      lastHash = await fs.promises.readFile(chainFile, "utf8");
    } catch {
    }

    let chainHash = lastHash;
    const dataLines = [];

    for (const logEntry of entries) {
      chainHash = crypto
        .createHmac("sha256", HMAC_KEY)
        .update(JSON.stringify(logEntry) + chainHash)
        .digest("hex");
      logEntry.integrityHash = chainHash;
      dataLines.push(JSON.stringify(logEntry));
    }

    await fs.promises.appendFile(filePath, dataLines.join("\n") + "\n", {
      mode: 0o600,
    });

    await fs.promises.writeFile(chainFile, chainHash, { mode: 0o600 });

    try {
      const moduleFolder = path.dirname(filePath);
      const moduleName = path.basename(moduleFolder);
      const counterFile = path.join(moduleFolder, "event-counter.json");

      const lastEntry = entries[entries.length - 1];
      const idPart = lastEntry?.id?.split("-").pop();
      const lastEventId = parseInt(idPart, 10) || 0;

      if (lastEventId > 0) {
        await fsp.writeFile(
          counterFile,
          JSON.stringify({ lastEventId }),
          { mode: 0o600 }
        );
      }
    } catch (err) {
      console.error(
        `[CounterUpdateError] Failed to update event-counter.json for ${filePath}:`,
        err.message
      );
    }
    // ==================================================================

  } catch (err) {
    console.error("[BufferedWriteError]", err.message);
  } finally {
    const release = logWriteLocks.get(filePath);
    if (release) {
      logWriteLocks.delete(filePath);
      releaseLock();
    }
  }
}


// ==================================================================
// [5] Queue log entries into buffer
// ==================================================================
async function writeLogBuffered(logEntry, logFile) {
  if (!logBuffers.has(logFile)) {
    logBuffers.set(logFile, { entries: [], timer: null });
  }

  const buf = logBuffers.get(logFile);
  buf.entries.push(logEntry);

  if (buf.entries.length >= 5) {
    await flushBuffer(logFile); // flush immediately if too full
  } else {
    scheduleBufferFlush(logFile);
  }
}

// ==================================================================
// [6] Custom levels
// ==================================================================
const customLevels = {
  levels: {
    error: 0,       // Serious issues that need attention
    critical: 1,    // Critical failures
    alert: 2,       // Alerts that require immediate action
    warn: 3,        // Warnings that might require review
    info: 4,        // General information
    http: 5,        // HTTP requests or responses
    verbose: 6,     // More detailed info for debugging
    debug: 7,       // Low-level debugging information
    silly: 8,       // Anything else; often for testing or verbose output
  },
  colors: {
    error: "red bold",
    critical: "red",
    alert: "magenta bold",
    warn: "yellow",
    info: "green",
    http: "cyan",
    verbose: "blue",
    debug: "white",
    silly: "grey",
  },
};


winston.addColors(customLevels.colors);

// ==================================================================
// [7] Clean old logs
// ==================================================================
function cleanOldLogs(moduleFolder) {
  fs.readdir(moduleFolder, (err, files) => {
    if (err) return;
    const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
    files.forEach((file) => {
      const filePath = path.join(moduleFolder, file);
      fs.stat(filePath, (err, stats) => {
        if (!err && stats.mtimeMs < cutoff) fs.unlink(filePath, () => {});
      });
    });
  });
}

// ==================================================================
// [8] Integrity Transport (buffered)
// ==================================================================
class IntegrityTransport extends Transport {
  constructor(opts) {
    super(opts);
    this.moduleName = opts.moduleName;
    this.logFile = opts.logFile;
  }

async log(info, callback) {
  try {
    const moduleFolder = path.join(logRoot, this.moduleName);
    const sysId = await generateSystemId(this.moduleName, moduleFolder);
    const key = `${this.moduleName}|${info.level}|${info.message}`;
    const now = Date.now();

    const last = dedupCache.get(key);
    if (last && now - last.lastLogTime < DEDUP_WINDOW_MS) {
      last.count += 1;
      dedupCache.set(key, last);
      return callback();
    }

    dedupCache.set(key, { lastLogTime: now, count: 1 });

    const logEntry = {
      id: sysId,
      channel: CHANNEL_NAME,
      severity: info.level.toUpperCase(),
      message: info.message,
      timestamp: info.timestamp || new Date().toISOString(),
      module: this.moduleName,
    };

    await writeLogBuffered(logEntry, this.logFile);
  } catch (err) {
    console.error("[IntegrityTransportError]", err.message);
  }
  callback();
}

}

// ==================================================================
// [9] Internal logger generator (PRIVATE)
// ==================================================================
function getModuleLogger(moduleName, options = {}, _internalCall = false) {
  if (!_internalCall) {
    throw new Error(
      `[System Logger] Direct calls to getModuleLogger() are not allowed. Use LoggerContainer.get("<module>") instead.`
    );
  }

  if (!moduleName) throw new Error("Module name is required");

  const moduleFolder = path.join(logRoot, moduleName);
  if (!fs.existsSync(moduleFolder)) {
    fs.mkdirSync(moduleFolder, { recursive: true, mode: 0o700 });
  }

  const date = new Date().toISOString().split("T")[0];
  const logFile = path.join(moduleFolder, `${moduleName}-${date}.json`);
  cleanOldLogs(moduleFolder);

  console.log(`[System Logger] Logging for module '${moduleName}' -> ${logFile}`);

  const consoleFormat = winston.format.printf(
    ({ level, message, timestamp }) => `[${timestamp}] [${level}] ${message}`
  );

  const transports = [new IntegrityTransport({ moduleName, logFile })];

  if (options.console === true) {
    transports.push(
      new winston.transports.Console({
        format: winston.format.combine(
          winston.format.colorize({ all: true }),
          winston.format.timestamp(),
          consoleFormat
        ),
      })
    );
  }

  return winston.createLogger({
    levels: customLevels.levels,
    level: options.level || "info",
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports,
    exitOnError: false,
  });
}

// ==================================================================
// [10] Flush everything (async + sync-safe version)
// ==================================================================
export async function flushLogger() {
  const flushes = [];
  for (const file of logBuffers.keys()) {
    flushes.push(flushBuffer(file));
  }
  await Promise.all(flushes);
  await new Promise((res) => setTimeout(res, 200));
}

// Synchronous fallback flush for exit hook
export function flushLoggerSync() {
  for (const [file, buf] of logBuffers.entries()) {
    if (buf && buf.entries.length > 0) {
      try {
        fs.appendFileSync(
          file,
          buf.entries.map((e) => JSON.stringify(e)).join("\n") + "\n",
          { mode: 0o600 }
        );
        buf.entries = [];
      } catch (err) {
        console.error(`[flushLoggerSync] Failed for ${file}:`, err.message);
      }
    }
  }
  console.log("[System Logger] Synchronous flush completed.");
}

// ==================================================================
// [10] Periodic dedup summary (safe & hardened)
// ==================================================================
setInterval(async () => {
  try {
    for (const [key, info] of dedupCache.entries()) {
      const [moduleName, level, message] = key.split("|");

      if (!moduleName || !level || !message) {
        console.warn(`[System Logger] Skipping invalid dedup entry: ${key}`);
        dedupCache.delete(key);
        continue;
      }

      // Prepare module-specific paths
      const moduleFolder = path.join(logRoot, moduleName);
      const logFile = path.join(
        moduleFolder,
        `${moduleName}-${new Date().toISOString().split("T")[0]}.json`
      );

      try {
        if (info.count > 1) {
          const sysId = await generateSystemId(moduleName, moduleFolder);
          const logEntry = {
            id: sysId,
            channel: CHANNEL_NAME,
            severity: level.toUpperCase(),
            message: `⚠️ Suppressed ${info.count - 1} duplicate entries: "${message}"`,
            timestamp: new Date().toISOString(),
            module: moduleName,
          };

          await writeLogBuffered(logEntry, logFile);
        }
      } catch (innerErr) {
        console.error(
          `[DedupSummaryError] Failed for module '${moduleName}':`,
          innerErr.message
        );
      }

      // Always clear cache entry after processing
      dedupCache.delete(key);
    }
  } catch (err) {
    console.error("[DedupSummaryFatalError]", err.message);
  }
}, 60_000); // summarize every 1 minute

// ==================================================================
// [11] Logger Cache and Container Creator
// ==================================================================
const loggerCache = new Map();

function createLoggerContainer() {
  return {
    get: (moduleName, options = {}) => {
      if (!loggerCache.has(moduleName)) {
        const logger = getModuleLogger(moduleName, options, true);
        loggerCache.set(moduleName, logger);
      }
      return loggerCache.get(moduleName);
    },
    list: () => Array.from(loggerCache.keys()),
    flush: async () => await flushLogger(),
  };
}

// ==================================================================
// [12] Graceful shutdown (internal to LoggerContainer)
// ==================================================================
async function internalShutdownLogger() {
  try {
    const allLoggers = Array.from(loggerCache.values());

    for (const log of allLoggers) {
      if (log && typeof log.info === "function") {
        log.info("Shutting down logger...");
      }
    }

    await flushLogger();
    console.log("[System Logger] Shutdown complete. All logs flushed.");
  } catch (err) {
    console.error("[System Logger] Error during shutdown:", err.message);
  }
}

// ==================================================================
// [13] LoggerContainer with automatic and manual shutdown handling
// ==================================================================
export const LoggerContainer = (() => {
  const container = createLoggerContainer();

  // Manual shutdown if explicitly called
  container.shutdown = async () => {
    if (container._shuttingDown) return;
    container._shuttingDown = true;
    await internalShutdownLogger();
  };

  // Automatic flush on process exit (sync-safe)
  process.on("exit", () => {
    if (!container._shuttingDown) {
      container._shuttingDown = true;
      flushLoggerSync(); // guaranteed safe inside exit
    }
  });

  return container;
})();

