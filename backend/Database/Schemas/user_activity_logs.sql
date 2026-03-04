CREATE TABLE IF NOT EXISTS user_activity_logs (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    activity_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    activity_type VARCHAR(120) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description VARCHAR(1000) NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(512) NULL,
    metadata_json JSON NULL,
    occurred_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_user_activity_logs_activity_id (activity_id),
    KEY ix_user_activity_logs_user_occurred (user_id, occurred_at),
    KEY ix_user_activity_logs_user_type (user_id, activity_type),
    CONSTRAINT fk_user_activity_logs_user
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
