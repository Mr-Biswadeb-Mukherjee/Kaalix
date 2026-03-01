-- Organization admins assignment table (SA managed)
CREATE TABLE IF NOT EXISTS organization_admins (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    org_id VARCHAR(191) NOT NULL,
    admin_user_id VARCHAR(255) NOT NULL,
    assigned_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_org_admins_org_id FOREIGN KEY (org_id) REFERENCES organizations(org_id) ON DELETE CASCADE,
    CONSTRAINT fk_org_admins_admin_user FOREIGN KEY (admin_user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_org_admins_assigned_by FOREIGN KEY (assigned_by) REFERENCES users(user_id) ON DELETE CASCADE,
    UNIQUE KEY ux_org_admins_org_admin (org_id, admin_user_id),
    KEY ix_org_admins_admin_user (admin_user_id)
);

-- Backfill: map each existing organization owner (if admin role) as an assigned admin
INSERT IGNORE INTO organization_admins (org_id, admin_user_id, assigned_by)
SELECT
    o.org_id,
    o.user_id AS admin_user_id,
    o.user_id AS assigned_by
FROM organizations o
INNER JOIN users u ON u.user_id = o.user_id
WHERE u.role = 'admin'
  AND o.org_id IS NOT NULL
  AND TRIM(o.org_id) <> '';
