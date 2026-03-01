-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(64) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 1,
    role ENUM('sa','admin') NOT NULL DEFAULT 'admin',
    account_status ENUM('active','blocked','deleted') NOT NULL DEFAULT 'active',
    deleted_at TIMESTAMP NULL DEFAULT NULL,
    hard_delete_at TIMESTAMP NULL DEFAULT NULL,
    super_admin_guard TINYINT GENERATED ALWAYS AS (
        CASE WHEN role = 'sa' THEN 1 ELSE NULL END
    ) STORED,
    failed_attempts INT DEFAULT 0,
    lock_until TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_single_super_admin (super_admin_guard)
);

-- Ensure username exists for already-created users table
SET @users_username_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'username'
);

SET @users_add_username_sql := IF(
    @users_username_column_exists = 0,
    "ALTER TABLE users ADD COLUMN username VARCHAR(64) NULL AFTER user_id",
    "SELECT 1"
);

PREPARE users_add_username_stmt FROM @users_add_username_sql;
EXECUTE users_add_username_stmt;
DEALLOCATE PREPARE users_add_username_stmt;

-- Backfill missing usernames deterministically
UPDATE users
SET username = CONCAT('user_', CAST(id AS CHAR))
WHERE username IS NULL OR TRIM(username) = '';

-- Repair duplicate usernames before adding unique index
UPDATE users u
INNER JOIN (
    SELECT username
    FROM users
    WHERE username IS NOT NULL AND TRIM(username) <> ''
    GROUP BY username
    HAVING COUNT(*) > 1
) d ON d.username = u.username
SET u.username = CONCAT('user_', CAST(u.id AS CHAR));

-- Ensure username is NOT NULL
ALTER TABLE users MODIFY COLUMN username VARCHAR(64) NOT NULL;

-- Ensure username unique index exists
SET @users_username_index_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'username'
      AND NON_UNIQUE = 0
);

SET @users_add_username_index_sql := IF(
    @users_username_index_exists = 0,
    "ALTER TABLE users ADD UNIQUE KEY ux_users_username (username)",
    "SELECT 1"
);

PREPARE users_add_username_index_stmt FROM @users_add_username_index_sql;
EXECUTE users_add_username_index_stmt;
DEALLOCATE PREPARE users_add_username_index_stmt;

-- Ensure role exists for already-created users table
SET @users_role_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'role'
);

SET @users_add_role_sql := IF(
    @users_role_column_exists = 0,
    "ALTER TABLE users ADD COLUMN role ENUM('sa','admin') NOT NULL DEFAULT 'admin' AFTER password",
    "SELECT 1"
);

PREPARE users_add_role_stmt FROM @users_add_role_sql;
EXECUTE users_add_role_stmt;
DEALLOCATE PREPARE users_add_role_stmt;

-- Ensure must_change_password exists for onboarding enforcement
SET @users_must_change_password_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'must_change_password'
);

SET @users_add_must_change_password_sql := IF(
    @users_must_change_password_exists = 0,
    "ALTER TABLE users ADD COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1 AFTER password",
    "SELECT 1"
);

PREPARE users_add_must_change_password_stmt FROM @users_add_must_change_password_sql;
EXECUTE users_add_must_change_password_stmt;
DEALLOCATE PREPARE users_add_must_change_password_stmt;

ALTER TABLE users MODIFY COLUMN must_change_password TINYINT(1) NOT NULL DEFAULT 1;

-- Backward-compat migration: super_admin -> sa
ALTER TABLE users MODIFY COLUMN role ENUM('sa','super_admin','admin') NOT NULL DEFAULT 'admin';
UPDATE users SET role = 'sa' WHERE role = 'super_admin';
ALTER TABLE users MODIFY COLUMN role ENUM('sa','admin') NOT NULL DEFAULT 'admin';

-- Ensure account_status exists for admin lifecycle controls
SET @users_account_status_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'account_status'
);

SET @users_add_account_status_sql := IF(
    @users_account_status_column_exists = 0,
    "ALTER TABLE users ADD COLUMN account_status ENUM('active','blocked','deleted') NOT NULL DEFAULT 'active' AFTER role",
    "SELECT 1"
);

PREPARE users_add_account_status_stmt FROM @users_add_account_status_sql;
EXECUTE users_add_account_status_stmt;
DEALLOCATE PREPARE users_add_account_status_stmt;

UPDATE users
SET account_status = 'active'
WHERE account_status IS NULL
   OR TRIM(account_status) = ''
   OR account_status NOT IN ('active', 'blocked', 'deleted');

ALTER TABLE users
MODIFY COLUMN account_status ENUM('active','blocked','deleted') NOT NULL DEFAULT 'active';

-- Ensure deleted_at exists for admin soft-delete metadata
SET @users_deleted_at_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'deleted_at'
);

SET @users_add_deleted_at_sql := IF(
    @users_deleted_at_column_exists = 0,
    "ALTER TABLE users ADD COLUMN deleted_at TIMESTAMP NULL DEFAULT NULL AFTER account_status",
    "SELECT 1"
);

PREPARE users_add_deleted_at_stmt FROM @users_add_deleted_at_sql;
EXECUTE users_add_deleted_at_stmt;
DEALLOCATE PREPARE users_add_deleted_at_stmt;

-- Ensure hard_delete_at exists for admin soft-delete metadata
SET @users_hard_delete_at_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'hard_delete_at'
);

SET @users_add_hard_delete_at_sql := IF(
    @users_hard_delete_at_column_exists = 0,
    "ALTER TABLE users ADD COLUMN hard_delete_at TIMESTAMP NULL DEFAULT NULL AFTER deleted_at",
    "SELECT 1"
);

PREPARE users_add_hard_delete_at_stmt FROM @users_add_hard_delete_at_sql;
EXECUTE users_add_hard_delete_at_stmt;
DEALLOCATE PREPARE users_add_hard_delete_at_stmt;

-- Backfill existing deleted admins with a 30-day purge schedule
UPDATE users
SET
    deleted_at = COALESCE(deleted_at, updated_at, CURRENT_TIMESTAMP),
    hard_delete_at = COALESCE(
        hard_delete_at,
        DATE_ADD(COALESCE(deleted_at, updated_at, CURRENT_TIMESTAMP), INTERVAL 30 DAY)
    )
WHERE role = 'admin'
  AND COALESCE(account_status, 'active') = 'deleted';

-- Clear stale soft-delete metadata for non-deleted accounts
UPDATE users
SET
    deleted_at = NULL,
    hard_delete_at = NULL
WHERE COALESCE(account_status, 'active') <> 'deleted';

-- Ensure generated guard column exists for sa uniqueness
SET @users_guard_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND COLUMN_NAME = 'super_admin_guard'
);

SET @users_add_guard_sql := IF(
    @users_guard_column_exists = 0,
    "ALTER TABLE users ADD COLUMN super_admin_guard TINYINT GENERATED ALWAYS AS (CASE WHEN role = 'sa' THEN 1 ELSE NULL END) STORED AFTER role",
    "SELECT 1"
);

PREPARE users_add_guard_stmt FROM @users_add_guard_sql;
EXECUTE users_add_guard_stmt;
DEALLOCATE PREPARE users_add_guard_stmt;

ALTER TABLE users MODIFY COLUMN super_admin_guard TINYINT GENERATED ALWAYS AS (
    CASE WHEN role = 'sa' THEN 1 ELSE NULL END
) STORED;

-- Ensure unique index exists (hard guarantee: at most one sa)
SET @users_guard_index_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'users'
      AND INDEX_NAME = 'ux_single_super_admin'
);

SET @users_add_guard_index_sql := IF(
    @users_guard_index_exists = 0,
    "ALTER TABLE users ADD UNIQUE KEY ux_single_super_admin (super_admin_guard)",
    "SELECT 1"
);

PREPARE users_add_guard_index_stmt FROM @users_add_guard_index_sql;
EXECUTE users_add_guard_index_stmt;
DEALLOCATE PREPARE users_add_guard_index_stmt;

-- Enforce exactly one sa max
DROP TRIGGER IF EXISTS users_before_insert_single_super_admin;
DROP TRIGGER IF EXISTS users_before_insert_single_sa;
CREATE TRIGGER users_before_insert_single_sa
BEFORE INSERT ON users
FOR EACH ROW
BEGIN
    IF NEW.role = 'sa'
       AND EXISTS (
           SELECT 1
           FROM users
           WHERE role = 'sa'
           LIMIT 1
       )
    THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Only one sa is allowed.';
    END IF;
END;

DROP TRIGGER IF EXISTS users_before_update_single_super_admin;
DROP TRIGGER IF EXISTS users_before_update_single_sa;
CREATE TRIGGER users_before_update_single_sa
BEFORE UPDATE ON users
FOR EACH ROW
BEGIN
    IF OLD.role = 'sa' AND NEW.role <> 'sa' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SA role cannot be changed.';
    END IF;

    IF NEW.role = 'sa'
       AND (OLD.role IS NULL OR OLD.role <> 'sa')
       AND EXISTS (
           SELECT 1
           FROM users
           WHERE role = 'sa'
             AND user_id <> OLD.user_id
           LIMIT 1
       )
    THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Only one sa is allowed.';
    END IF;
END;

DROP TRIGGER IF EXISTS users_before_delete_protect_sa;
CREATE TRIGGER users_before_delete_protect_sa
BEFORE DELETE ON users
FOR EACH ROW
BEGIN
    IF OLD.role = 'sa' THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'SA account cannot be deleted.';
    END IF;
END;

-- MFA methods table
CREATE TABLE IF NOT EXISTS user_mfa (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    mfa_id CHAR(24) NOT NULL UNIQUE,
    method VARCHAR(50) NOT NULL,
    status ENUM('enabled','disabled') DEFAULT 'disabled',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY ux_user_mfa_user_method (user_id, method)
);

-- MFA data table
CREATE TABLE IF NOT EXISTS user_mfa_data (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    mfa_id CHAR(24) NOT NULL,
    `key` VARCHAR(50) NOT NULL,
    `value` TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mfa_id) REFERENCES user_mfa(mfa_id) ON DELETE CASCADE,
    UNIQUE KEY ux_mfa_data_mfa_key (mfa_id, `key`)
);
