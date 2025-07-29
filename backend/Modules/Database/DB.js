import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT
} = process.env;

if (!DB_NAME) {
  console.error("❌ DB_NAME is not defined in .env");
  process.exit(1);
}

let pool;

export async function initDatabase() {
  try {
    // Step 1: Connect without DB to create it if needed
    const connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT || 3306
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    console.log(`✅ Database '${DB_NAME}' ensured.`);
    await connection.end();

    // Step 2: Create pool using the DB
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT || 3306,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0
    });

    // Step 3: Ensure required tables exist
    await ensureTablesExist(pool);

    // Step 4: Test connection
    const conn = await pool.getConnection();
    console.log("✅ MySQL pool connected.");
    conn.release();

    return pool;
  } catch (error) {
    console.error("❌ MySQL Initialization Error:", error.message);
    process.exit(1);
  }
}

async function ensureTablesExist(pool) {
  // Check if 'users' table exists, and create it if not
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
  console.log("✅ Table 'users' ensured.");
}

export { pool };
