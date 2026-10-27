CREATE DATABASE IF NOT EXISTS auspify_inventory_db
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE auspify_inventory_db;

DROP TABLE IF EXISTS stock_transactions;
DROP TABLE IF EXISTS products;

-- 1. Products Table
CREATE TABLE products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sku VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(80) NOT NULL,
    supplier VARCHAR(120) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL CHECK (unit_price >= 0),
    quantity INT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    reorder_threshold INT NOT NULL DEFAULT 5 CHECK (reorder_threshold >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE INDEX idx_products_sku ON products(sku);
CREATE INDEX idx_products_name ON products(name);
CREATE INDEX idx_products_category ON products(category);

-- 2. Stock Transactions Table (Ledger)
CREATE TABLE stock_transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id INT NOT NULL,
    transaction_type ENUM('IN', 'OUT') NOT NULL,
    quantity INT NOT NULL CHECK (quantity > 0),
    remarks VARCHAR(255) DEFAULT NULL,
    transaction_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_transactions_product
        FOREIGN KEY (product_id) REFERENCES products(id)
        ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX idx_transactions_product ON stock_transactions(product_id);
CREATE INDEX idx_transactions_type ON stock_transactions(transaction_type);
CREATE INDEX idx_transactions_date ON stock_transactions(transaction_date);

-- Seed Data: 8 Products (Mix of Healthy Stock, Low Stock, and Out of Stock)
INSERT INTO products (sku, name, category, supplier, unit_price, quantity, reorder_threshold) VALUES
('TECH-LAP-001', 'ThinkPad T14 Gen 3', 'Laptops', 'Lenovo Direct', 1250.00, 45, 10),
('TECH-MON-022', 'Dell UltraSharp 27', 'Monitors', 'Dell Technologies', 450.00, 12, 15),     -- Low Stock
('TECH-KBD-105', 'Keychron K8 Pro', 'Peripherals', 'Keychron Inc.', 95.00, 8, 10),        -- Low Stock
('TECH-MOU-099', 'Logitech MX Master 3S', 'Peripherals', 'Logitech', 99.99, 0, 5),        -- Out of Stock
('TECH-NET-301', 'Cisco Meraki Go Router', 'Networking', 'Cisco Systems', 145.00, 2, 5),  -- Low Stock
('TECH-STO-550', 'Samsung 980 PRO 1TB', 'Storage', 'Samsung Electronics', 110.00, 120, 20),
('TECH-ACC-881', 'Anker 735 Charger', 'Accessories', 'Anker Innovations', 45.00, 35, 15),
('TECH-AUD-404', 'Sony WH-1000XM5', 'Audio', 'Sony Corp', 348.00, 4, 8);                  -- Low Stock

-- Seed Transactions (Simulating recent inventory movements)
INSERT INTO stock_transactions (product_id, transaction_type, quantity, remarks, transaction_date) VALUES
(1, 'IN', 50, 'Initial restock for Q4', DATE_SUB(NOW(), INTERVAL 10 DAY)),
(1, 'OUT', 5, 'Assigned to new engineering hires', DATE_SUB(NOW(), INTERVAL 2 DAY)),
(2, 'IN', 20, 'Vendor delivery', DATE_SUB(NOW(), INTERVAL 15 DAY)),
(2, 'OUT', 8, 'Office upgrade project', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(4, 'OUT', 2, 'Last units sold out', DATE_SUB(NOW(), INTERVAL 1 DAY)),
(5, 'OUT', 1, 'Replacement for faulty router', DATE_SUB(NOW(), INTERVAL 3 DAY));