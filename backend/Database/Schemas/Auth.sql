-- Users table
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    must_change_password TINYINT(1) NOT NULL DEFAULT 1,
    role ENUM('sa','admin') NOT NULL DEFAULT 'admin',
    super_admin_guard TINYINT GENERATED ALWAYS AS (
        CASE WHEN role = 'sa' THEN 1 ELSE NULL END
    ) STORED,
    failed_attempts INT DEFAULT 0,
    lock_until TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_single_super_admin (super_admin_guard)
);

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
