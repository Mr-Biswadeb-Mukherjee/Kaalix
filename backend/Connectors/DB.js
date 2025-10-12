import mysql from "mysql2/promise";
import { mysql as mysqlConfig } from "../Confs/config.js";
import { initializeDatabase } from "../Database/init.loader.js";
import { LoggerContainer, flushLogger } from "../Logger/Logger.js";

const logger = LoggerContainer.get("Database");

const { host, user, password, database, port, maxPoolSize = 20 } = mysqlConfig;

if (!database) {
  logger.critical("❌ DB_NAME is not defined in config.js");
  await flushLogger();
  process.exit(1);
}

let pool;

// =============================================================
// Internal State Tracker (prevents duplicate spam)
// =============================================================
const dbState = {
  verified: false,
  connected: false,
  ready: false,
  reconnecting: false,
};

// =============================================================
// Utility: Controlled logging (log only once per state)
// =============================================================
function logOnce(stateKey, message, level = "info") {
  if (!dbState[stateKey]) {
    dbState[stateKey] = true;
    logger[level](message);
  }
}

function resetDbState() {
  dbState.verified = false;
  dbState.connected = false;
  dbState.ready = false;
}

// =============================================================
// Utility: Exponential Backoff + Jitter
// =============================================================
async function delay(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function reconnectWithBackoff(maxRetries = 10) {
  let attempt = 0;

  while (attempt < maxRetries) {
    const baseDelay = Math.min(1000 * 2 ** attempt, 30000); // exponential up to 30s
    const jitter = Math.floor(Math.random() * 1000);         // random ±1s
    const waitTime = baseDelay + jitter;

    logger.warn(`⏳ Reconnection attempt #${attempt + 1} in ${(waitTime / 1000).toFixed(1)}s...`);
    await delay(waitTime);

    try {
      await initDatabase(true); // pass true to mark as reconnection
      logger.info("🔁 Database reconnected successfully.");
      return;
    } catch (err) {
      attempt++;
      logger.error(`⚠️  Reconnection attempt #${attempt} failed: ${err.message}`);
    }
  }

  logger.critical("💀 Maximum reconnection attempts reached. Manual intervention required.");
  await flushLogger();
  process.exit(1);
}

// =============================================================
// Database Initialization (with reconnection logic)
// =============================================================
export async function initDatabase(isReconnecting = false) {
  if (pool && !isReconnecting) return pool; // Singleton unless forced

  try {
    // STEP 1: Bootstrap connection (only if not reconnecting)
    if (!isReconnecting) {
      const bootstrap = await mysql.createConnection({
        host,
        user,
        password,
        port,
        multipleStatements: true,
      });

      await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
      logOnce("verified", `🏗️  Database '${database}' verified/created`);
      await bootstrap.end();
    }

    // STEP 2: Create pool
    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: maxPoolSize,
      queueLimit: 0,
      multipleStatements: true,
    });

    // Test connection
    await pool.getConnection().then(conn => conn.release());
    logOnce("connected", "💾 Database connection established");

    // STEP 3: Initialize tables (only in dev)
    if (process.env.NODE_ENV !== "production") {
      await initializeDatabase(pool);
    }

    logOnce("ready", "✅ Database and tables are ready");

    // =========================================================
    // Pool Error Handling
    // =========================================================
    pool.on("error", async (err) => {
      if (dbState.reconnecting) return; // avoid duplicate attempts
      dbState.reconnecting = true;

      logger.error(`❌ MySQL Pool Error: ${err.message}`);
      resetDbState();

      try {
        await reconnectWithBackoff();
      } catch (fatalErr) {
        logger.critical(`💀 Fatal error during reconnection: ${fatalErr.message}`);
        await flushLogger();
        process.exit(1);
      } finally {
        dbState.reconnecting = false;
      }
    });

    return pool;

  } catch (err) {
    logger.error(`❌ MySQL Initialization Error: ${err.message}`);
    await flushLogger();
    setTimeout(() => process.exit(1), 100);
  }
}

export { pool };
