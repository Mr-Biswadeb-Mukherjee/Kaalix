-- Profiles table
CREATE TABLE IF NOT EXISTS profiles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    profile_id CHAR(36) NULL UNIQUE,
    fullName VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    bio TEXT,
    website_url VARCHAR(255) NULL,
    profile_url VARCHAR(255),
    location_consent TINYINT(1) NULL DEFAULT NULL,
    location_lat DECIMAL(10,7) NULL,
    location_lng DECIMAL(10,7) NULL,
    location_accuracy_m DECIMAL(10,2) NULL,
    location_captured_at TIMESTAMP NULL DEFAULT NULL,
    location_label VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_profiles_user_id FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
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

-- Ensure website_url exists for already-created profiles table
SET @profiles_website_url_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'website_url'
);

SET @profiles_add_website_url_sql := IF(
    @profiles_website_url_column_exists = 0,
    "ALTER TABLE profiles ADD COLUMN website_url VARCHAR(255) NULL AFTER bio",
    "SELECT 1"
);

PREPARE profiles_add_website_url_stmt FROM @profiles_add_website_url_sql;
EXECUTE profiles_add_website_url_stmt;
DEALLOCATE PREPARE profiles_add_website_url_stmt;

-- Ensure location_consent exists for already-created profiles table
SET @profiles_location_consent_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'location_consent'
);

SET @profiles_add_location_consent_sql := IF(
    @profiles_location_consent_column_exists = 0,
    "ALTER TABLE profiles ADD COLUMN location_consent TINYINT(1) NULL DEFAULT NULL AFTER profile_url",
    "SELECT 1"
);

PREPARE profiles_add_location_consent_stmt FROM @profiles_add_location_consent_sql;
EXECUTE profiles_add_location_consent_stmt;
DEALLOCATE PREPARE profiles_add_location_consent_stmt;

-- Ensure location_lat exists for already-created profiles table
SET @profiles_location_lat_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'location_lat'
);

SET @profiles_add_location_lat_sql := IF(
    @profiles_location_lat_column_exists = 0,
    "ALTER TABLE profiles ADD COLUMN location_lat DECIMAL(10,7) NULL AFTER location_consent",
    "SELECT 1"
);

PREPARE profiles_add_location_lat_stmt FROM @profiles_add_location_lat_sql;
EXECUTE profiles_add_location_lat_stmt;
DEALLOCATE PREPARE profiles_add_location_lat_stmt;

-- Ensure location_lng exists for already-created profiles table
SET @profiles_location_lng_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'location_lng'
);

SET @profiles_add_location_lng_sql := IF(
    @profiles_location_lng_column_exists = 0,
    "ALTER TABLE profiles ADD COLUMN location_lng DECIMAL(10,7) NULL AFTER location_lat",
    "SELECT 1"
);

PREPARE profiles_add_location_lng_stmt FROM @profiles_add_location_lng_sql;
EXECUTE profiles_add_location_lng_stmt;
DEALLOCATE PREPARE profiles_add_location_lng_stmt;

-- Ensure location_accuracy_m exists for already-created profiles table
SET @profiles_location_accuracy_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'location_accuracy_m'
);

SET @profiles_add_location_accuracy_sql := IF(
    @profiles_location_accuracy_column_exists = 0,
    "ALTER TABLE profiles ADD COLUMN location_accuracy_m DECIMAL(10,2) NULL AFTER location_lng",
    "SELECT 1"
);

PREPARE profiles_add_location_accuracy_stmt FROM @profiles_add_location_accuracy_sql;
EXECUTE profiles_add_location_accuracy_stmt;
DEALLOCATE PREPARE profiles_add_location_accuracy_stmt;

-- Ensure location_captured_at exists for already-created profiles table
SET @profiles_location_captured_at_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'location_captured_at'
);

SET @profiles_add_location_captured_at_sql := IF(
    @profiles_location_captured_at_column_exists = 0,
    "ALTER TABLE profiles ADD COLUMN location_captured_at TIMESTAMP NULL DEFAULT NULL AFTER location_accuracy_m",
    "SELECT 1"
);

PREPARE profiles_add_location_captured_at_stmt FROM @profiles_add_location_captured_at_sql;
EXECUTE profiles_add_location_captured_at_stmt;
DEALLOCATE PREPARE profiles_add_location_captured_at_stmt;

-- Ensure location_label exists for already-created profiles table
SET @profiles_location_label_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'location_label'
);

SET @profiles_add_location_label_sql := IF(
    @profiles_location_label_column_exists = 0,
    "ALTER TABLE profiles ADD COLUMN location_label VARCHAR(255) NULL AFTER location_captured_at",
    "SELECT 1"
);

PREPARE profiles_add_location_label_stmt FROM @profiles_add_location_label_sql;
EXECUTE profiles_add_location_label_stmt;
DEALLOCATE PREPARE profiles_add_location_label_stmt;

