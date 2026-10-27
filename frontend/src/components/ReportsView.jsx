import React, { useEffect, useState } from 'react';
import { api, exportToCsv, formatCurrency, getStockStatus } from '../api.js';
import { DownloadIcon } from './Icons.jsx';

export default function ReportsView({ notify }) {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadReportData() {
      setLoading(true);
      try {
        const [prodRes, txRes] = await Promise.all([
          api.getProducts(),
          api.getTransactions()
        ]);
        setProducts(prodRes.data);
        setTransactions(txRes.data);
      } catch (err) {
        notify('error', err.message || 'Failed to generate inventory reports.');
      } finally {
        setLoading(false);
      }
    }
    loadReportData();
  }, []);

  if (loading) {
    return <div className="state-box">Generating inventory valuation and movement reports...</div>;
  }

  // Group by category
  const categoryMap = {};
  products.forEach((p) => {
    if (!categoryMap[p.category]) {
      categoryMap[p.category] = {
        category: p.category,
        skuCount: 0,
        totalUnits: 0,
        totalValue: 0,
        lowOrOutCount: 0
      };
    }
    const entry = categoryMap[p.category];
    entry.skuCount += 1;
    entry.totalUnits += Number(p.quantity);
    entry.totalValue += Number(p.quantity) * Number(p.unit_price);
    if (Number(p.quantity) <= Number(p.reorder_threshold)) {
      entry.lowOrOutCount += 1;
    }
  });

  const categoryRows = Object.values(categoryMap).sort((a, b) => b.totalValue - a.totalValue);

  const handleExportInventoryCsv = () => {
    const formatted = products.map((p) => ({
      ...p,
      total_value: (Number(p.quantity) * Number(p.unit_price)).toFixed(2),
      status: getStockStatus(p.quantity, p.reorder_threshold).label
    }));

    exportToCsv('inventory_stock_report.csv', formatted, [
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product Name' },
      { key: 'category', label: 'Category' },
      { key: 'supplier', label: 'Supplier' },
      { key: 'unit_price', label: 'Unit Price ($)' },
      { key: 'quantity', label: 'Stock Quantity' },
      { key: 'reorder_threshold', label: 'Reorder Threshold' },
      { key: 'total_value', label: 'Total Valuation ($)' },
      { key: 'status', label: 'Stock Status' }
    ]);
    notify('success', 'Downloaded inventory_stock_report.csv');
  };

  const handleExportTransactionsCsv = () => {
    exportToCsv('stock_movements_history.csv', transactions, [
      { key: 'id', label: 'Transaction ID' },
      { key: 'transaction_type', label: 'Type' },
      { key: 'sku', label: 'SKU' },
      { key: 'name', label: 'Product Name' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'remarks', label: 'Remarks' },
      { key: 'transaction_date', label: 'Timestamp' }
    ]);
    notify('success', 'Downloaded stock_movements_history.csv');
  };

  return (
    <div className="view-section">
      {/* CSV Export Header */}
      <div className="card quick-actions-bar">
        <div>
          <h3>Inventory Analytics & CSV Exports</h3>
          <p className="muted-text">
            Download full product stock valuation or historical stock movements as CSV spreadsheets.
          </p>
        </div>
        <div className="action-btn-group">
          <button className="btn btn-primary" onClick={handleExportInventoryCsv}>
            <DownloadIcon /> Export Inventory Report (CSV)
          </button>
          <button className="btn btn-secondary" onClick={handleExportTransactionsCsv}>
            <DownloadIcon /> Export Movement History (CSV)
          </button>
        </div>
      </div>

      {/* Category Breakdown Table */}
      <div className="card">
        <h3>Category-Wise Valuation & Stock Health</h3>
        <p className="muted-text" style={{ marginBottom: '16px' }}>
          Aggregated unit counts, total asset valuation, and restock alerts across product categories.
        </p>

        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Unique SKUs</th>
                <th>Total Units in Stock</th>
                <th>Restock Alerts</th>
                <th>Total Category Valuation</th>
              </tr>
            </thead>
            <tbody>
              {categoryRows.map((row) => (
                <tr key={row.category}>
                  <td>
                    <strong>{row.category}</strong>
                  </td>
                  <td>{row.skuCount}</td>
                  <td>
                    <strong>{row.totalUnits}</strong> units
                  </td>
                  <td>
                    {row.lowOrOutCount > 0 ? (
                      <span className="status-pill badge-amber">
                        {row.lowOrOutCount} needs attention
                      </span>
                    ) : (
                      <span className="status-pill badge-emerald">All Healthy</span>
                    )}
                  </td>
                  <td>
                    <strong>{formatCurrency(row.totalValue)}</strong>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}