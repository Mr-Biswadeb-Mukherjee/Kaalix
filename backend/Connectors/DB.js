import mysql from 'mysql2/promise';
import { mysql as mysqlConfig } from '../Confs/config.js'; // adjust path if necessary

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
  // Users table
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) UNIQUE NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password VARCHAR(255) NOT NULL,
      failed_attempts INT DEFAULT 0,
      lock_until TIMESTAMP NULL DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;

  // Profiles table
  const createProfilesTable = `
    CREATE TABLE IF NOT EXISTS profiles (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      profile_id CHAR(36) NOT NULL UNIQUE,
      fullName VARCHAR(255) NOT NULL,
      phone VARCHAR(20),
      bio TEXT,
      profile_url VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
    );
  `;

  await pool.execute(createUsersTable);
  await pool.execute(createProfilesTable);
}


export { pool };
