-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    profile_id CHAR(36) NULL UNIQUE,
    fullName VARCHAR(255) NOT NULL,
    org VARCHAR(255) NULL,
    org_id VARCHAR(64) NULL,
    phone VARCHAR(20),
    bio TEXT,
    profile_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY ux_profiles_org_id (org_id)
);

-- Ensure profile_id is nullable (generated only after user customizes profile)
SET @profiles_profile_id_is_nullable := (
    SELECT IFNULL(IS_NULLABLE, 'YES')
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'profile_id'
    LIMIT 1
);

SET @profiles_make_profile_id_nullable_sql := IF(
    @profiles_profile_id_is_nullable = 'NO',
    "ALTER TABLE profiles MODIFY COLUMN profile_id CHAR(36) NULL",
    "SELECT 1"
);

PREPARE profiles_make_profile_id_nullable_stmt FROM @profiles_make_profile_id_nullable_sql;
EXECUTE profiles_make_profile_id_nullable_stmt;
DEALLOCATE PREPARE profiles_make_profile_id_nullable_stmt;

-- Ensure org exists for already-created profiles table
SET @profiles_org_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'org'
);

SET @profiles_add_org_sql := IF(
    @profiles_org_column_exists = 0,
    "ALTER TABLE profiles ADD COLUMN org VARCHAR(255) NULL AFTER fullName",
    "SELECT 1"
);

PREPARE profiles_add_org_stmt FROM @profiles_add_org_sql;
EXECUTE profiles_add_org_stmt;
DEALLOCATE PREPARE profiles_add_org_stmt;

-- Ensure org_id exists for already-created profiles table
SET @profiles_org_id_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'org_id'
);

SET @profiles_add_org_id_sql := IF(
    @profiles_org_id_column_exists = 0,
    "ALTER TABLE profiles ADD COLUMN org_id VARCHAR(64) NULL AFTER org",
    "SELECT 1"
);

PREPARE profiles_add_org_id_stmt FROM @profiles_add_org_id_sql;
EXECUTE profiles_add_org_id_stmt;
DEALLOCATE PREPARE profiles_add_org_id_stmt;

-- Ensure org_id unique index exists
SET @profiles_org_id_index_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND INDEX_NAME = 'ux_profiles_org_id'
);

SET @profiles_add_org_id_index_sql := IF(
    @profiles_org_id_index_exists = 0,
    "ALTER TABLE profiles ADD UNIQUE KEY ux_profiles_org_id (org_id)",
    "SELECT 1"
);

PREPARE profiles_add_org_id_index_stmt FROM @profiles_add_org_id_index_sql;
EXECUTE profiles_add_org_id_index_stmt;
DEALLOCATE PREPARE profiles_add_org_id_index_stmt;
