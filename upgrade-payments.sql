-- Añade estado e identificadores de pago sin borrar pedidos existentes.
SET @column_missing = (SELECT COUNT(*) = 0 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='orders' AND column_name='payment_status');
SET @ddl = IF(@column_missing, 'ALTER TABLE orders ADD COLUMN payment_status VARCHAR(24) NOT NULL DEFAULT ''not_required''', 'SELECT 1');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @column_missing = (SELECT COUNT(*) = 0 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='orders' AND column_name='payment_status_detail');
SET @ddl = IF(@column_missing, 'ALTER TABLE orders ADD COLUMN payment_status_detail VARCHAR(80) NULL', 'SELECT 1');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @column_missing = (SELECT COUNT(*) = 0 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='orders' AND column_name='mercadopago_order_id');
SET @ddl = IF(@column_missing, 'ALTER TABLE orders ADD COLUMN mercadopago_order_id VARCHAR(64) NULL', 'SELECT 1');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @column_missing = (SELECT COUNT(*) = 0 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='orders' AND column_name='payment_checkout_url');
SET @ddl = IF(@column_missing, 'ALTER TABLE orders ADD COLUMN payment_checkout_url TEXT NULL', 'SELECT 1');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @column_missing = (SELECT COUNT(*) = 0 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='orders' AND column_name='payment_idempotency_key');
SET @ddl = IF(@column_missing, 'ALTER TABLE orders ADD COLUMN payment_idempotency_key CHAR(36) NULL', 'SELECT 1');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @column_missing = (SELECT COUNT(*) = 0 FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='orders' AND column_name='payment_key_hash');
SET @ddl = IF(@column_missing, 'ALTER TABLE orders ADD COLUMN payment_key_hash CHAR(64) NULL', 'SELECT 1');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;

SET @index_missing = (SELECT COUNT(*) = 0 FROM information_schema.statistics WHERE table_schema=DATABASE() AND table_name='orders' AND index_name='uq_orders_mp_order');
SET @ddl = IF(@index_missing, 'CREATE UNIQUE INDEX uq_orders_mp_order ON orders(mercadopago_order_id)', 'SELECT 1');
PREPARE migration_stmt FROM @ddl; EXECUTE migration_stmt; DEALLOCATE PREPARE migration_stmt;