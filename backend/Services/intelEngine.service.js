import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { getActiveSerpApiKey } from "./intelApiKey.service.js";

const execFileAsync = promisify(execFile);
const ENGINE_TIMEOUT_MS = 45_000;
const ENGINE_STDIO_MAX_BUFFER_BYTES = 4 * 1024 * 1024;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const ENGINE_ENTRYPOINT = "./Engine";

const createEngineError = (status, message, code, details = "") => {
  const err = new Error(message);
  err.status = status;
  err.code = code;
  if (details) err.details = details;
  return err;
};

const parseJsonOutput = (stdout, context) => {
  const text = typeof stdout === "string" ? stdout.trim() : "";
  if (!text) {
    throw createEngineError(502, `${context} returned empty output.`, "INTEL_ENGINE_EMPTY_OUTPUT");
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    const startIndex = text.indexOf("{");
    const endIndex = text.lastIndexOf("}");
    if (startIndex >= 0 && endIndex > startIndex) {
      const candidate = text.slice(startIndex, endIndex + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        // fall through to canonical error
      }
    }

    const sample = text.slice(0, 300);
    throw createEngineError(
      502,
      `${context} returned non-JSON output.`,
      "INTEL_ENGINE_INVALID_OUTPUT",
      sample || err.message
    );
  }
};

const runEngineCommand = async (args, context) => {
  try {
    const serpApiKey = await getActiveSerpApiKey();
    const result = await execFileAsync("go", ["run", ENGINE_ENTRYPOINT, ...args], {
      cwd: PROJECT_ROOT,
      timeout: ENGINE_TIMEOUT_MS,
      maxBuffer: ENGINE_STDIO_MAX_BUFFER_BYTES,
      env: {
        ...process.env,
        GOCACHE: process.env.GOCACHE || "/tmp/go-build",
        ...(serpApiKey ? { SERPAPI_KEY: serpApiKey } : {}),
      },
    });

    return parseJsonOutput(result.stdout, context);
  } catch (err) {
    if (err?.status && err?.code) {
      throw err;
    }

    if (err?.code === "ENOENT") {
      throw createEngineError(
        503,
        "Go runtime not found. Install Go to run KaaliX engine.",
        "INTEL_ENGINE_GO_MISSING"
      );
    }

    if (err?.killed || err?.signal === "SIGTERM") {
      throw createEngineError(
        504,
        "KaaliX engine timed out while processing the request.",
        "INTEL_ENGINE_TIMEOUT"
      );
    }

    const stderr = typeof err?.stderr === "string" ? err.stderr.trim() : "";
    throw createEngineError(
      502,
      "KaaliX engine execution failed.",
      "INTEL_ENGINE_EXECUTION_FAILED",
      stderr || err?.message || "Unknown engine failure"
    );
  }
};

export const listEngineCollectors = async () =>
  runEngineCommand(["-list", "-json"], "KaaliX engine collector listing");

export const runEngineQuery = async ({ query, type = "query", id = "seed-1" }) => {
  const cleanQuery = typeof query === "string" ? query.trim() : "";
  if (!cleanQuery) {
    throw createEngineError(400, "Query is required.", "INTEL_QUERY_REQUIRED");
  }

  return runEngineCommand(
    ["-json", "-type", String(type || "query"), "-id", String(id || "seed-1"), "-value", cleanQuery],
    "KaaliX engine query run"
  );
};

export default {
  listEngineCollectors,
  runEngineQuery,
};
