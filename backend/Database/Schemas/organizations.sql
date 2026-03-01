-- Organizations table
CREATE TABLE IF NOT EXISTS organizations (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    org_id VARCHAR(191) NOT NULL,
    org_name VARCHAR(255) NOT NULL,
    org_website VARCHAR(255) NULL,
    org_email VARCHAR(255) NULL,
    org_sa VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_organizations_user_id FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY ux_organizations_user_id (user_id),
    UNIQUE KEY ux_organizations_org_id (org_id)
);

-- Ensure organizations.org_id exists (nullable during migration)
SET @organizations_org_id_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizations'
      AND COLUMN_NAME = 'org_id'
);

SET @organizations_add_org_id_sql := IF(
    @organizations_org_id_column_exists = 0,
    "ALTER TABLE organizations ADD COLUMN org_id VARCHAR(191) NULL AFTER user_id",
    "SELECT 1"
);

PREPARE organizations_add_org_id_stmt FROM @organizations_add_org_id_sql;
EXECUTE organizations_add_org_id_stmt;
DEALLOCATE PREPARE organizations_add_org_id_stmt;

-- Ensure organizations.org_name exists (nullable during migration)
SET @organizations_org_name_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizations'
      AND COLUMN_NAME = 'org_name'
);

SET @organizations_add_org_name_sql := IF(
    @organizations_org_name_column_exists = 0,
    "ALTER TABLE organizations ADD COLUMN org_name VARCHAR(255) NULL AFTER org_id",
    "SELECT 1"
);

PREPARE organizations_add_org_name_stmt FROM @organizations_add_org_name_sql;
EXECUTE organizations_add_org_name_stmt;
DEALLOCATE PREPARE organizations_add_org_name_stmt;

-- Ensure organizations.org_website exists
SET @organizations_org_website_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizations'
      AND COLUMN_NAME = 'org_website'
);

SET @organizations_add_org_website_sql := IF(
    @organizations_org_website_column_exists = 0,
    "ALTER TABLE organizations ADD COLUMN org_website VARCHAR(255) NULL AFTER org_name",
    "SELECT 1"
);

PREPARE organizations_add_org_website_stmt FROM @organizations_add_org_website_sql;
EXECUTE organizations_add_org_website_stmt;
DEALLOCATE PREPARE organizations_add_org_website_stmt;

-- Ensure organizations.org_email exists
SET @organizations_org_email_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizations'
      AND COLUMN_NAME = 'org_email'
);

SET @organizations_add_org_email_sql := IF(
    @organizations_org_email_column_exists = 0,
    "ALTER TABLE organizations ADD COLUMN org_email VARCHAR(255) NULL AFTER org_website",
    "SELECT 1"
);

PREPARE organizations_add_org_email_stmt FROM @organizations_add_org_email_sql;
EXECUTE organizations_add_org_email_stmt;
DEALLOCATE PREPARE organizations_add_org_email_stmt;

-- Ensure organizations.org_sa exists
SET @organizations_org_sa_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizations'
      AND COLUMN_NAME = 'org_sa'
);

SET @organizations_add_org_sa_sql := IF(
    @organizations_org_sa_column_exists = 0,
    "ALTER TABLE organizations ADD COLUMN org_sa VARCHAR(255) NULL AFTER org_email",
    "SELECT 1"
);

PREPARE organizations_add_org_sa_stmt FROM @organizations_add_org_sa_sql;
EXECUTE organizations_add_org_sa_stmt;
DEALLOCATE PREPARE organizations_add_org_sa_stmt;

-- Ensure organizations.updated_at exists
SET @organizations_updated_at_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizations'
      AND COLUMN_NAME = 'updated_at'
);

SET @organizations_add_updated_at_sql := IF(
    @organizations_updated_at_column_exists = 0,
    "ALTER TABLE organizations ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER created_at",
    "SELECT 1"
);

PREPARE organizations_add_updated_at_stmt FROM @organizations_add_updated_at_sql;
EXECUTE organizations_add_updated_at_stmt;
DEALLOCATE PREPARE organizations_add_updated_at_stmt;

-- Ensure organizations FK exists
SET @organizations_fk_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizations'
      AND CONSTRAINT_TYPE = 'FOREIGN KEY'
      AND CONSTRAINT_NAME = 'fk_organizations_user_id'
);

SET @organizations_add_fk_sql := IF(
    @organizations_fk_exists = 0,
    "ALTER TABLE organizations ADD CONSTRAINT fk_organizations_user_id FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE",
    "SELECT 1"
);

PREPARE organizations_add_fk_stmt FROM @organizations_add_fk_sql;
EXECUTE organizations_add_fk_stmt;
DEALLOCATE PREPARE organizations_add_fk_stmt;

-- Ensure organizations unique index on user_id exists
SET @organizations_user_id_index_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizations'
      AND INDEX_NAME = 'ux_organizations_user_id'
);

SET @organizations_add_user_id_index_sql := IF(
    @organizations_user_id_index_exists = 0,
    "ALTER TABLE organizations ADD UNIQUE KEY ux_organizations_user_id (user_id)",
    "SELECT 1"
);

PREPARE organizations_add_user_id_index_stmt FROM @organizations_add_user_id_index_sql;
EXECUTE organizations_add_user_id_index_stmt;
DEALLOCATE PREPARE organizations_add_user_id_index_stmt;

-- Ensure organizations unique index on org_id exists
SET @organizations_org_id_index_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'organizations'
      AND INDEX_NAME = 'ux_organizations_org_id'
);

SET @organizations_add_org_id_index_sql := IF(
    @organizations_org_id_index_exists = 0,
    "ALTER TABLE organizations ADD UNIQUE KEY ux_organizations_org_id (org_id)",
    "SELECT 1"
);

PREPARE organizations_add_org_id_index_stmt FROM @organizations_add_org_id_index_sql;
EXECUTE organizations_add_org_id_index_stmt;
DEALLOCATE PREPARE organizations_add_org_id_index_stmt;

-- Detect legacy columns in profiles before migration/drop
SET @profiles_legacy_org_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'org'
);

SET @profiles_legacy_org_id_column_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND COLUMN_NAME = 'org_id'
);

-- Backfill organizations from legacy profiles.org + profiles.org_id if needed
SET @migrate_legacy_org_sql := IF(
    @profiles_legacy_org_column_exists > 0 AND @profiles_legacy_org_id_column_exists > 0,
    "INSERT INTO organizations (user_id, org_id, org_name, org_website, org_email, org_sa)
     SELECT p.user_id,
            CASE
              WHEN p.org_id IS NOT NULL AND TRIM(p.org_id) <> '' THEN p.org_id
              ELSE CONCAT(
                COALESCE(NULLIF(LOWER(REPLACE(REPLACE(REPLACE(TRIM(p.org), ' ', '-'), '/', '-'), '--', '-')), ''), 'org'),
                '-',
                UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))
              )
            END AS org_id,
            COALESCE(NULLIF(TRIM(p.org), ''), 'Organization') AS org_name,
            NULL,
            NULL,
            NULL
     FROM profiles p
     LEFT JOIN organizations o ON o.user_id = p.user_id
     WHERE o.user_id IS NULL
       AND ((p.org IS NOT NULL AND TRIM(p.org) <> '') OR (p.org_id IS NOT NULL AND TRIM(p.org_id) <> ''))",
    IF(
      @profiles_legacy_org_column_exists > 0,
      "INSERT INTO organizations (user_id, org_id, org_name, org_website, org_email, org_sa)
       SELECT p.user_id,
              CONCAT(
                COALESCE(NULLIF(LOWER(REPLACE(REPLACE(REPLACE(TRIM(p.org), ' ', '-'), '/', '-'), '--', '-')), ''), 'org'),
                '-',
                UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))
              ) AS org_id,
              COALESCE(NULLIF(TRIM(p.org), ''), 'Organization') AS org_name,
              NULL,
              NULL,
              NULL
       FROM profiles p
       LEFT JOIN organizations o ON o.user_id = p.user_id
       WHERE o.user_id IS NULL
         AND p.org IS NOT NULL
         AND TRIM(p.org) <> ''",
      IF(
        @profiles_legacy_org_id_column_exists > 0,
        "INSERT INTO organizations (user_id, org_id, org_name, org_website, org_email, org_sa)
         SELECT p.user_id,
                CASE
                  WHEN p.org_id IS NOT NULL AND TRIM(p.org_id) <> '' THEN p.org_id
                  ELSE CONCAT('org-', UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8)))
                END AS org_id,
                'Organization' AS org_name,
                NULL,
                NULL,
                NULL
         FROM profiles p
         LEFT JOIN organizations o ON o.user_id = p.user_id
         WHERE o.user_id IS NULL
           AND p.org_id IS NOT NULL
           AND TRIM(p.org_id) <> ''",
        "SELECT 1"
      )
    )
);

PREPARE migrate_legacy_org_stmt FROM @migrate_legacy_org_sql;
EXECUTE migrate_legacy_org_stmt;
DEALLOCATE PREPARE migrate_legacy_org_stmt;

-- Backfill empty org_name/org_id inside organizations to satisfy NOT NULL constraints
UPDATE organizations
SET org_name = 'Organization'
WHERE org_name IS NULL OR TRIM(org_name) = '';

UPDATE organizations
SET org_id = CONCAT(
    COALESCE(NULLIF(LOWER(REPLACE(REPLACE(REPLACE(TRIM(org_name), ' ', '-'), '/', '-'), '--', '-')), ''), 'org'),
    '-',
    UPPER(SUBSTRING(REPLACE(UUID(), '-', ''), 1, 8))
)
WHERE org_id IS NULL OR TRIM(org_id) = '';

ALTER TABLE organizations MODIFY COLUMN org_name VARCHAR(255) NOT NULL;
ALTER TABLE organizations MODIFY COLUMN org_id VARCHAR(191) NOT NULL;

-- Drop legacy unique index on profiles.org_id if still present
SET @profiles_legacy_org_id_index_exists := (
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'profiles'
      AND INDEX_NAME = 'ux_profiles_org_id'
);

SET @profiles_drop_legacy_org_id_index_sql := IF(
    @profiles_legacy_org_id_index_exists > 0,
    "ALTER TABLE profiles DROP INDEX ux_profiles_org_id",
    "SELECT 1"
);

PREPARE profiles_drop_legacy_org_id_index_stmt FROM @profiles_drop_legacy_org_id_index_sql;
EXECUTE profiles_drop_legacy_org_id_index_stmt;
DEALLOCATE PREPARE profiles_drop_legacy_org_id_index_stmt;

-- Drop legacy org_id column from profiles
SET @profiles_drop_legacy_org_id_column_sql := IF(
    @profiles_legacy_org_id_column_exists > 0,
    "ALTER TABLE profiles DROP COLUMN org_id",
    "SELECT 1"
);

PREPARE profiles_drop_legacy_org_id_column_stmt FROM @profiles_drop_legacy_org_id_column_sql;
EXECUTE profiles_drop_legacy_org_id_column_stmt;
DEALLOCATE PREPARE profiles_drop_legacy_org_id_column_stmt;

-- Drop legacy org column from profiles
SET @profiles_drop_legacy_org_column_sql := IF(
    @profiles_legacy_org_column_exists > 0,
    "ALTER TABLE profiles DROP COLUMN org",
    "SELECT 1"
);

PREPARE profiles_drop_legacy_org_column_stmt FROM @profiles_drop_legacy_org_column_sql;
EXECUTE profiles_drop_legacy_org_column_stmt;
DEALLOCATE PREPARE profiles_drop_legacy_org_column_stmt;

