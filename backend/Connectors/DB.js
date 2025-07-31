import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const {
  DB_HOST,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  DB_PORT,
  MAX_POOL_SIZE
} = process.env;

if (!DB_NAME) {
  console.error("❌ DB_NAME is not defined in .env");
  process.exit(1);
}

const maxPool = parseInt(MAX_POOL_SIZE, 10) || 10;

let pool;

export async function initDatabase() {
  try {
    // Step 1: Connect without DB to create it if needed
    const connection = await mysql.createConnection({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      port: DB_PORT
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\`;`);
    //console.log(`✅ Database '${DB_NAME}' ensured.`);
    await connection.end();

    // Step 2: Create pool using the DB
    pool = mysql.createPool({
      host: DB_HOST,
      user: DB_USER,
      password: DB_PASSWORD,
      database: DB_NAME,
      port: DB_PORT,
      waitForConnections: true,
      connectionLimit: maxPool,
      // Note: mysql2 doesn't have a built-in minPool setting, but we can simulate it later with warm-up if needed
      queueLimit: 0
    });

    // Step 3: Ensure required tables exist
    await ensureTablesExist(pool);

    // Step 4: Test connection
    const conn = await pool.getConnection();
    //console.log("✅ MySQL pool connected.");
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
  //console.log("✅ Table 'users' ensured.");
}

export { pool };
