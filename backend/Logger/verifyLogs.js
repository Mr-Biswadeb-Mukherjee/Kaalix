import fs from "fs";
import path from "path";
import readline from "readline";
import crypto from "crypto";
import chalk from "chalk";

const HMAC_KEY = process.env.LOGGER_HMAC_KEY || null;

// ======================================================================
// [1] Verify a single log file
// ======================================================================
export async function verifyLogFileIntegrity(logFile) {
  const fileName = path.basename(logFile);

  // Skip unwanted or non-log files automatically
  if (
    fileName.startsWith(".") ||
    fileName === "event-counter.json" ||
    fileName === ".chainstate" ||
    !fileName.match(/^[\w-]+-\d{4}-\d{2}-\d{2}\.json$/)
  ) {
    return { file: fileName, skipped: true };
  }

  if (!fs.existsSync(logFile)) {
    return { file: fileName, error: "File not found" };
  }

  const rl = readline.createInterface({
    input: fs.createReadStream(logFile, { encoding: "utf8" }),
    crlfDelay: Infinity,
  });

  let lastHash = "";
  let lineNumber = 0;
  let verifiedCount = 0;
  let brokenCount = 0;
  let chainBrokenAt = null;
  let lastEntryHash = null;

  for await (const line of rl) {
    lineNumber++;
    const trimmed = line.trim();
    if (!trimmed) continue;

    let entry;
    try {
      entry = JSON.parse(trimmed);
    } catch {
      brokenCount = 1;
      chainBrokenAt = lineNumber;
      break;
    }

    if (!entry.integrityHash) {
      brokenCount = 1;
      chainBrokenAt = lineNumber;
      break;
    }

    // Recompute expected hash
    const recalculated = crypto
      .createHmac("sha256", HMAC_KEY)
      .update(JSON.stringify({ ...entry, integrityHash: undefined }) + lastHash)
      .digest("hex");

    if (entry.integrityHash !== recalculated) {
      brokenCount = 1;
      chainBrokenAt = lineNumber;
      break; // stop at first mismatch
    } else {
      verifiedCount++;
      lastHash = recalculated;
      lastEntryHash = entry.integrityHash;
    }
  }

  rl.close();

  return {
    file: fileName,
    verifiedCount,
    brokenCount,
    valid: brokenCount === 0,
    chainBrokenAt,
    skipped: false,
    lastEntryHash,
    folder: path.dirname(logFile),
  };
}

// ======================================================================
// [2] Verify `.chainstate` for a folder
// ======================================================================
async function verifyChainstate(folder, lastEntryHash) {
  const chainFile = path.join(folder, ".chainstate");
  if (!fs.existsSync(chainFile)) {
    return { chainValid: false, reason: "Missing .chainstate file" };
  }

  const storedHash = (await fs.promises.readFile(chainFile, "utf8")).trim();

  if (storedHash === lastEntryHash) {
    return { chainValid: true };
  }

  return { chainValid: false, reason: "Mismatch with last log entry hash", storedHash, lastEntryHash };
}

// ======================================================================
// [3] Verify all log files in a directory (recursive)
// ======================================================================
async function walkAndVerify(dir) {
  const results = [];
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      const subResults = await walkAndVerify(fullPath);
      results.push(...subResults);
    } else {
      const res = await verifyLogFileIntegrity(fullPath);
      results.push(res);
    }
  }

  return results;
}

// ======================================================================
// [4] Unified entry point (single file OR folder)
// ======================================================================
export async function verifyLogs(targetPath) {
  if (!fs.existsSync(targetPath)) {
    console.error(chalk.red(`Path not found: ${targetPath}`));
    process.exit(1);
  }

  const stats = await fs.promises.stat(targetPath);
  let results = [];

  if (stats.isDirectory()) {
    results = await walkAndVerify(targetPath);
  } else if (stats.isFile()) {
    const res = await verifyLogFileIntegrity(targetPath);
    results.push(res);
  } else {
    console.error(chalk.red(`Invalid path type: ${targetPath}`));
    process.exit(1);
  }

  // ======================================================================
  // [5] Chainstate verification per folder
  // ======================================================================
  const folders = new Map();
  results.forEach(r => {
    if (!r.skipped && r.folder) {
      if (!folders.has(r.folder) || (folders.get(r.folder).lastEntryHash < r.lastEntryHash)) {
        folders.set(r.folder, r);
      }
    }
  });

  const chainstateResults = [];
  for (const [folder, lastLog] of folders.entries()) {
    const chainRes = await verifyChainstate(folder, lastLog.lastEntryHash);
    chainstateResults.push({ folder, ...chainRes });
  }

  // ======================================================================
  // [6] Generate verification report
  // ======================================================================
  console.log(chalk.bold("\n===== Integrity Verification Report ====="));

  for (const res of results) {
    if (res.skipped) {
      //console.log(chalk.yellow(`[⚠️ SKIPPED] ${res.file}`));
      continue;
    }
    if (res.error) {
      console.log(chalk.red(`[❌ ERROR] ${res.file}: ${res.error}`));
      continue;
    }

    const status = res.valid ? chalk.green("✅ OK") : chalk.red("❌ CORRUPTED");
    console.log(
      `[${status}] ${res.file} | Entries: ${res.verifiedCount} | Broken: ${res.brokenCount}`
    );

    if (!res.valid && res.chainBrokenAt) {
      console.log(`   - Chain broken at line: ${res.chainBrokenAt}`);
    }
  }

  console.log(chalk.bold("\n===== .chainstate Verification ====="));
  for (const c of chainstateResults) {
    if (c.chainValid) {
      console.log(chalk.green(`[✅ OK] ${c.folder}`));
    } else {
      console.log(chalk.red(`[❌ MISMATCH] ${c.folder} | Reason: ${c.reason}`));
      if (c.storedHash && c.lastEntryHash)
        console.log(`   stored: ${c.storedHash}\n   expected: ${c.lastEntryHash}`);
    }
  }

  console.log(chalk.bold("=========================================\n"));
  console.log(
    chalk.cyanBright(
      `Integrity verification complete. Verified ${results.filter(r => !r.skipped).length
      } log files across ${chainstateResults.length} module folders.`
    )
  );

  return { logs: results, chainstate: chainstateResults };
}

// ======================================================================
// [7] CLI usage support
// ======================================================================
if (import.meta.url === `file://${process.argv[1]}`) {
  const target = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(process.cwd(), "Logs");

  verifyLogs(target).catch((err) => {
    console.error(chalk.red("Verification failed:"), err);
    process.exit(1);
  });
}
