// backend/Database/init.loader.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";
import { LoggerContainer } from "../Logger/Logger.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const logger = LoggerContainer.get("Schemas");


/**
 * Initialize the database by executing all SQL files in order.
 * Tracks execution and re-applies files if they change.
 *
 * @param {import('mysql2/promise').Pool} pool - The MySQL connection pool
 */
export async function initializeDatabase(pool) {
  logger.info("🧩 Database initialization started...");

  // Path to the Schemas folder
  const dbDir = path.join(__dirname, "Schemas");

  // Get all .sql files in the folder
  const files = fs.readdirSync(dbDir).filter(f => f.toLowerCase().endsWith(".sql"));
  const orderedFiles = getExecutionOrder(files, dbDir);

  for (const file of orderedFiles) {
    const filePath = path.join(dbDir, file);
    const sql = fs.readFileSync(filePath, "utf8").trim();
    if (!sql) continue;

    // Compute SHA-256 hash of the file
    const hash = crypto.createHash("sha256").update(sql).digest("hex");

    // Check if file has been executed before
    let existing;
    try {
      [existing] = await pool.query(
        "SELECT hash FROM _init_history WHERE filename = ?",
        [file]
      );
    } catch (err) {
      // Skip if _init_history doesn't exist yet (db_history.sql will create it)
      existing = [];
    }

    if (existing.length > 0) {
      if (existing[0].hash === hash) {
        logger.verbose(`⚙️  Skipping ${file} (unchanged)`);
        continue;
      } else {
        logger.warn(`🔄 Re-applying ${file} (file changed)`);
        try {
          await pool.query(sql);
          await pool.query(
            "UPDATE _init_history SET hash = ?, executed_at = CURRENT_TIMESTAMP WHERE filename = ?",
            [hash, file]
          );
        } catch (err) {
          logger.error(`❌ Error executing ${file}: ${err.message}`);
          process.exit(1);
        }
        continue;
      }
    }

    // First-time execution
    try { 
      logger.info(`📦 Executing ${file}...`);
      await pool.query(sql);
      await pool.query(
        "INSERT INTO _init_history (filename, hash) VALUES (?, ?)",
        [file, hash]
      );
    } catch (err) {
      logger.error(`❌ Error executing ${file}: ${err.message}`);
      process.exit(1);
    }
  }

  logger.info("✅ Database initialization complete.");
}

/**
 * Determine the execution order of SQL files.
 * Respects SOURCE commands in init.sql if present.
 *
 * @param {string[]} files - List of .sql files
 * @param {string} dbDir - Path to the Schemas directory
 * @returns {string[]} Ordered list of files to execute
 */
function getExecutionOrder(files, dbDir) {
  const initFile = "init.sql";
  let ordered = [];

  if (files.includes(initFile)) {
    const initContent = fs.readFileSync(path.join(dbDir, initFile), "utf8");
    const regex = /SOURCE\s+(.+?);/gi;
    let match;
    const sources = [];

    while ((match = regex.exec(initContent)) !== null) {
      const ref = path.basename(match[1].trim());
      if (ref) sources.push(ref);
    }

    // Execute files referenced in init.sql first
    ordered = [
      ...sources.filter(f => files.includes(f)),
      // Remaining files alphabetically (excluding init.sql and sources)
      ...files.filter(f => f !== initFile && !sources.includes(f)).sort(),
    ];
  } else {
    ordered = files.sort(); // default alphabetical order
  }

  return ordered;
}
