CREATE DATABASE IF NOT EXISTS tabas_originals
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE tabas_originals;

CREATE TABLE IF NOT EXISTS products (
  codigo VARCHAR(100) NOT NULL PRIMARY KEY,
  descripcion VARCHAR(500) NOT NULL,
  marca VARCHAR(120) NULL,
  precio_venta DECIMAL(10,2) NULL,
  precio_normal DECIMAL(10,2) NULL,
  imagen_url VARCHAR(1000) NULL,
  categoria ENUM('Hombre','Mujer','Niños','Unisex') NOT NULL DEFAULT 'Hombre',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_products_brand (marca),
  INDEX idx_products_active (activo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS product_sizes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  codigo VARCHAR(100) NOT NULL,
  talla VARCHAR(20) NOT NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  UNIQUE KEY uq_product_size (codigo, talla),
  INDEX idx_sizes_stock (stock),
  CONSTRAINT fk_product_sizes_product FOREIGN KEY (codigo) REFERENCES products(codigo) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS orders (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  customer_name VARCHAR(160) NOT NULL,
  customer_phone VARCHAR(40) NOT NULL,
  delivery_address VARCHAR(500) NOT NULL,
  notes TEXT NULL,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  status ENUM('pending','confirmed','preparing','shipped','delivered','cancelled') NOT NULL DEFAULT 'pending',
  payment_status VARCHAR(24) NOT NULL DEFAULT 'not_required',
  payment_status_detail VARCHAR(80) NULL,
  mercadopago_order_id VARCHAR(64) NULL UNIQUE,
  payment_checkout_url TEXT NULL,
  payment_idempotency_key CHAR(36) NULL,
  payment_key_hash CHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_orders_status_date (status, created_at)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS order_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED NOT NULL,
  codigo VARCHAR(100) NOT NULL,
  descripcion VARCHAR(500) NOT NULL,
  marca VARCHAR(120) NULL,
  talla VARCHAR(20) NULL,
  cantidad INT UNSIGNED NOT NULL,
  precio_unitario DECIMAL(10,2) NOT NULL,
  stock_reservado TINYINT(1) NOT NULL DEFAULT 0,
  CONSTRAINT fk_order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  CONSTRAINT fk_order_items_product FOREIGN KEY (codigo) REFERENCES products(codigo) ON DELETE RESTRICT,
  INDEX idx_order_items_order (order_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS admin_users (
  username VARCHAR(80) NOT NULL PRIMARY KEY,
  password_hash VARCHAR(200) NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS app_sessions (
  session_id VARCHAR(128) NOT NULL PRIMARY KEY,
  expires_at BIGINT UNSIGNED NOT NULL,
  session_data MEDIUMTEXT NOT NULL,
  INDEX idx_app_sessions_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
