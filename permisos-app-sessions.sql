-- Ejecutar conectado como un administrador MySQL.
CREATE TABLE IF NOT EXISTS tabas_originals.app_sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires_at BIGINT UNSIGNED NOT NULL,
  session_data MEDIUMTEXT NOT NULL,
  INDEX idx_app_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

GRANT SELECT, INSERT, UPDATE, DELETE
ON tabas_originals.app_sessions
TO 'tabas_app'@'127.0.0.1';
