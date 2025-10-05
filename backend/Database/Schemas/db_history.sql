-- db.history.sql
-- Table to track executed SQL files and their hashes
CREATE TABLE IF NOT EXISTS _init_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    filename VARCHAR(255) NOT NULL UNIQUE,
    hash VARCHAR(128) NOT NULL,
    executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
