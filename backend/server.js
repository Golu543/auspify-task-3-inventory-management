const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(cors());
app.use(express.json());

// MySQL Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'auspify_inventory_db',
  port: Number(process.env.DB_PORT) || 3306,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Validation Helper
function validateProduct(data) {
  const errors = [];
  const { sku, name, category, supplier, unit_price, reorder_threshold } = data;
  if (!sku || sku.trim().length < 3) errors.push('Valid SKU is required.');
  if (!name || name.trim().length < 2) errors.push('Product name is required.');
  if (!category) errors.push('Category is required.');
  if (!supplier) errors.push('Supplier is required.');
  if (isNaN(unit_price) || Number(unit_price) < 0) errors.push('Unit price must be a positive number.');
  if (isNaN(reorder_threshold) || Number(reorder_threshold) < 0) errors.push('Reorder threshold must be 0 or greater.');
  return errors;
}

// 1. Dashboard Metrics
app.get('/api/dashboard', async (req, res) => {
  try {
    const [metrics] = await pool.query(`
      SELECT 
        COUNT(*) AS total_products,
        COALESCE(SUM(quantity * unit_price), 0) AS total_valuation,
        SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock,
        SUM(CASE WHEN quantity > 0 AND quantity <= reorder_threshold THEN 1 ELSE 0 END) AS low_stock
      FROM products
    `);
    
    const [recentTx] = await pool.query(`
      SELECT t.id, t.transaction_type, t.quantity, t.transaction_date, p.name, p.sku
      FROM stock_transactions t
      JOIN products p ON t.product_id = p.id
      ORDER BY t.transaction_date DESC LIMIT 5
    `);

    res.json({ success: true, data: { ...metrics[0], recent_transactions: recentTx } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to load dashboard metrics.' });
  }
});

// 2. Product Management (CRUD)
app.get('/api/products', async (req, res) => {
  try {
    const { search = '', category = '', stock_status = '' } = req.query;
    let query = 'SELECT * FROM products WHERE 1=1';
    const params = [];

    if (search.trim()) {
      query += ' AND (name LIKE ? OR sku LIKE ? OR supplier LIKE ?)';
      const term = `%${search.trim()}%`;
      params.push(term, term, term);
    }
    if (category.trim()) {
      query += ' AND category = ?';
      params.push(category.trim());
    }
    if (stock_status === 'out') {
      query += ' AND quantity = 0';
    } else if (stock_status === 'low') {
      query += ' AND quantity > 0 AND quantity <= reorder_threshold';
    } else if (stock_status === 'in') {
      query += ' AND quantity > reorder_threshold';
    }

    query += ' ORDER BY id DESC';
    const [rows] = await pool.query(query, params);
    
    const [categories] = await pool.query('SELECT DISTINCT category FROM products ORDER BY category');
    
    res.json({ success: true, data: rows, categories: categories.map(c => c.category) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to retrieve products.' });
  }
});

app.post('/api/products', async (req, res) => {
  try {
    const errors = validateProduct(req.body);
    if (errors.length > 0) return res.status(400).json({ success: false, message: errors.join(' ') });

    const { sku, name, category, supplier, unit_price, quantity = 0, reorder_threshold } = req.body;
    
    const [result] = await pool.query(
      `INSERT INTO products (sku, name, category, supplier, unit_price, quantity, reorder_threshold) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [sku.trim().toUpperCase(), name.trim(), category.trim(), supplier.trim(), Number(unit_price), Number(quantity), Number(reorder_threshold)]
    );
    
    res.status(201).json({ success: true, message: 'Product added successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'SKU already exists.' });
    res.status(500).json({ success: false, message: 'Failed to add product.' });
  }
});

app.put('/api/products/:id', async (req, res) => {
  try {
    const errors = validateProduct(req.body);
    if (errors.length > 0) return res.status(400).json({ success: false, message: errors.join(' ') });

    const { sku, name, category, supplier, unit_price, reorder_threshold } = req.body;
    await pool.query(
      `UPDATE products SET sku=?, name=?, category=?, supplier=?, unit_price=?, reorder_threshold=? WHERE id=?`,
      [sku.trim().toUpperCase(), name.trim(), category.trim(), supplier.trim(), Number(unit_price), Number(reorder_threshold), req.params.id]
    );
    res.json({ success: true, message: 'Product updated successfully.' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ success: false, message: 'SKU already exists.' });
    res.status(500).json({ success: false, message: 'Failed to update product.' });
  }
});

app.delete('/api/products/:id', async (req, res) => {
  try {
    const [txCount] = await pool.query('SELECT COUNT(*) as count FROM stock_transactions WHERE product_id = ?', [req.params.id]);
    if (txCount[0].count > 0) {
      return res.status(400).json({ success: false, message: 'Cannot delete product with existing transaction history.' });
    }
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Product deleted.' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to delete product.' });
  }
});

// 3. Stock Transactions (ACID compliant IN/OUT)
app.post('/api/transactions', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { product_id, transaction_type, quantity, remarks = '' } = req.body;
    const qty = Number(quantity);

    if (!product_id || !['IN', 'OUT'].includes(transaction_type) || isNaN(qty) || qty <= 0) {
      return res.status(400).json({ success: false, message: 'Invalid transaction parameters.' });
    }

    await connection.beginTransaction();

    const [products] = await connection.query('SELECT name, quantity FROM products WHERE id = ? FOR UPDATE', [product_id]);
    if (products.length === 0) throw new Error('Product not found.');
    
    const currentStock = products[0].quantity;

    if (transaction_type === 'OUT' && currentStock < qty) {
      await connection.rollback();
      return res.status(400).json({ success: false, message: `Insufficient stock. Only ${currentStock} units available.` });
    }

    const newStock = transaction_type === 'IN' ? currentStock + qty : currentStock - qty;

    await connection.query('UPDATE products SET quantity = ? WHERE id = ?', [newStock, product_id]);
    await connection.query(
      'INSERT INTO stock_transactions (product_id, transaction_type, quantity, remarks) VALUES (?, ?, ?, ?)',
      [product_id, transaction_type, qty, remarks.trim()]
    );

    await connection.commit();
    res.json({ success: true, message: `Stock successfully updated. New quantity: ${newStock}` });
  } catch (error) {
    await connection.rollback();
    res.status(500).json({ success: false, message: error.message || 'Transaction failed.' });
  } finally {
    connection.release();
  }
});

app.get('/api/transactions', async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT t.id, t.transaction_type, t.quantity, t.remarks, t.transaction_date, p.name, p.sku 
      FROM stock_transactions t
      JOIN products p ON t.product_id = p.id
      ORDER BY t.id DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch history.' });
  }
});

app.listen(PORT, () => console.log(`Inventory API running on port ${PORT}`));