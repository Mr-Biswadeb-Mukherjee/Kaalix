import mysql from "mysql2/promise";
import fs from "fs";
import { mysql as mysqlConfig } from "../Confs/config.js";
import { initializeDatabase } from "../Database/init.loader.js";

const { host, user, password, database, port, maxPoolSize = 20 } = mysqlConfig;

if (!database) {
  console.error("❌ DB_NAME is not defined in config.js");
  process.exit(1);
}

let pool;

export async function initDatabase() {
  if (pool) return pool; // Singleton pool

  try {
    // STEP 1: Bootstrap connection without specifying the database
    const bootstrap = await mysql.createConnection({
      host,
      user,
      password,
      port,
      multipleStatements: true,
    });

    await bootstrap.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    console.log(`🏗️  Database '${database}' verified/created`);
    await bootstrap.end();

    // STEP 2: Now create pool for that database
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
    console.log("💾 Database connection established");

    // STEP 3: Auto-initialize tables (only in dev)
    if (process.env.NODE_ENV !== "production") {
      await initializeDatabase(pool);
    }

    console.log("✅ Database and tables are ready");
    return pool;
  } catch (err) {
    console.error("❌ MySQL Initialization Error:", err.message);
    process.exit(1);
  }
}

export { pool };
