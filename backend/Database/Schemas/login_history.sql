CREATE TABLE IF NOT EXISTS login_history (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    login_id VARCHAR(64) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    ip_address VARCHAR(64) NULL,
    user_agent VARCHAR(512) NULL,
    logged_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY ux_login_history_login_id (login_id),
    KEY ix_login_history_user_logged_in (user_id, logged_in_at),
    CONSTRAINT fk_login_history_user
      FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE CASCADE
);
