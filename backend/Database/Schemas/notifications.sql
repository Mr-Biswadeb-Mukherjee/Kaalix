-- Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    notification_id VARCHAR(40) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    actor_user_id VARCHAR(255) NULL,
    type VARCHAR(64) NOT NULL DEFAULT 'system',
    severity ENUM('info', 'success', 'warning', 'critical') NOT NULL DEFAULT 'info',
    title VARCHAR(255) NOT NULL,
    message VARCHAR(1000) NOT NULL,
    metadata_json LONGTEXT NULL,
    is_read TINYINT(1) NOT NULL DEFAULT 0,
    read_at TIMESTAMP NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY ux_notifications_notification_id (notification_id),
    KEY ix_notifications_user_created (user_id, created_at),
    KEY ix_notifications_user_unread (user_id, is_read, created_at),
    CONSTRAINT fk_notifications_user_id
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE,
    CONSTRAINT fk_notifications_actor_user_id
      FOREIGN KEY (actor_user_id) REFERENCES users(user_id) ON DELETE SET NULL
);
