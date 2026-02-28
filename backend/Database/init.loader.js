// backend/Database/init.loader.js
import fs from "fs";
import path from "path";
import crypto from "crypto";
import bcrypt from "bcrypt";
import { v4 as uuidv4 } from "uuid";
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
 * Seed a default SA user on first app startup.
 * If an SA user already exists, this is a no-op.
 */
export async function ensureDefaultSaAccount(pool) {
  const defaultUsername =
    (process.env.DEFAULT_SA_USERNAME || "Amon Super Admin").trim();
  const defaultEmail = String(
    process.env.DEFAULT_SA_EMAIL || "amon.sa@gmail.com"
  )
    .trim()
    .toLowerCase();
  const defaultPassword = String(
    process.env.DEFAULT_SA_PASSWORD || "ChangeMe@123"
  );

  if (!defaultEmail || !defaultPassword) {
    logger.warn("⚠️ Skipping SA seed: DEFAULT_SA_EMAIL/PASSWORD is empty.");
    return;
  }

  const [requiredTables] = await pool.query(
    `SELECT table_name
     FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE()
       AND table_name IN ('users', 'profiles')`
  );

  if (!requiredTables || requiredTables.length < 2) {
    logger.warn("⚠️ Skipping SA seed: users/profiles tables are not ready.");
    return;
  }

  const [roleColumn] = await pool.query(
    `SELECT column_name
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND table_name = 'users'
       AND column_name = 'role'
     LIMIT 1`
  );

  if (!roleColumn || roleColumn.length === 0) {
    logger.warn("⚠️ Skipping SA seed: users.role column not found.");
    return;
  }

  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [saRows] = await conn.execute(
      "SELECT user_id FROM users WHERE role = 'sa' LIMIT 1 FOR UPDATE"
    );

    if (saRows.length > 0) {
      const saUserId = saRows[0].user_id;
      const [profileRows] = await conn.execute(
        "SELECT profile_id FROM profiles WHERE user_id = ? LIMIT 1",
        [saUserId]
      );

      if (profileRows.length === 0) {
        await conn.execute(
          "INSERT INTO profiles (user_id, profile_id, fullName) VALUES (?, ?, ?)",
          [saUserId, null, defaultUsername]
        );
        logger.warn(`⚠️ SA profile was missing and has been restored for ${saUserId}.`);
      }

      await conn.commit();
      logger.verbose("⚙️ Default SA seed skipped: existing SA found.");
      return;
    }

    const hashedPassword = await bcrypt.hash(defaultPassword, 10);
    const userId = `AMON-SA-${uuidv4().replace(/-/g, "").slice(0, 10)}`;

    await conn.execute(
      "INSERT INTO users (user_id, email, password, role, must_change_password) VALUES (?, ?, ?, 'sa', 1)",
      [userId, defaultEmail, hashedPassword]
    );

    await conn.execute(
      "INSERT INTO profiles (user_id, profile_id, fullName) VALUES (?, ?, ?)",
      [userId, null, defaultUsername]
    );

    await conn.commit();
    logger.warn(
      `🔐 Default SA user created (email: ${defaultEmail}, role: sa). Change DEFAULT_SA_PASSWORD immediately.`
    );
  } catch (err) {
    await conn.rollback();

    if (
      err?.message?.includes("Only one sa is allowed") ||
      err?.message?.includes("ux_single_super_admin")
    ) {
      logger.warn("⚠️ SA seed skipped: an SA user already exists.");
      return;
    }

    throw err;
  } finally {
    conn.release();
  }
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
