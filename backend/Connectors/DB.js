// database.js (ES module)

import mysql from 'mysql2/promise';
import { mysql as mysqlConfig } from '../Confs/config.js'; // adjust the path if necessary

const {
  host,
  user,
  password,
  database,
  port,
  maxPoolSize
} = {
  ...mysqlConfig,
  maxPoolSize: mysqlConfig.maxPoolSize || 10,
};

if (!database) {
  console.error("❌ DB_NAME is not defined in config.js");
  process.exit(1);
}

let pool;

export async function initDatabase() {
  try {
    // Step 1: Connect without DB to create it if needed
    const connection = await mysql.createConnection({
      host,
      user,
      password,
      port
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${database}\`;`);
    await connection.end();

    // Step 2: Create pool using the DB
    pool = mysql.createPool({
      host,
      user,
      password,
      database,
      port,
      waitForConnections: true,
      connectionLimit: maxPoolSize,
      queueLimit: 0
    });

    // Step 3: Ensure required tables exist
    await ensureTablesExist(pool);

    // Step 4: Test connection
    const conn = await pool.getConnection();
    conn.release();

    return pool;
  } catch (error) {
    console.error("❌ MySQL Initialization Error:", error.message);
    process.exit(1);
  }
}

async function ensureTablesExist(pool) {
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      fullName VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  await pool.execute(createUsersTable);
}

export { pool };
