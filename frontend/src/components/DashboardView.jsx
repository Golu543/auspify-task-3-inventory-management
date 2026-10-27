import React, { useEffect, useState } from 'react';
import { api, formatCurrency, formatDateTime, getStockStatus } from '../api.js';

export default function DashboardView({ onNavigate, notify }) {
  const [data, setData] = useState(null);
  const [alertItems, setAlertItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      const [dashRes, prodRes] = await Promise.all([
        api.getDashboard(),
        api.getProducts()
      ]);
      setData(dashRes.data);
      const alerts = prodRes.data.filter((p) => Number(p.quantity) <= Number(p.reorder_threshold));
      setAlertItems(alerts);
    } catch (err) {
      notify('error', err.message || 'Failed to load dashboard metrics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  if (loading) {
    return <div className="state-box">Loading real-time warehouse metrics...</div>;
  }

  if (!data) {
    return (
      <div className="state-box">
        <p>Could not connect to Inventory API on port 5002.</p>
        <button className="btn btn-primary" onClick={loadDashboard}>
          Retry Connection
        </button>
      </div>
    );
  }

  const totalProducts = Number(data.total_products || 0);
  const lowStockCount = Number(data.low_stock || 0);
  const outOfStockCount = Number(data.out_of_stock || 0);
  const healthyStockCount = Math.max(0, totalProducts - lowStockCount - outOfStockCount);

  return (
    <div className="view-section">
      {/* KPI Summary Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <span className="metric-label">Total SKU Products</span>
          <strong className="metric-value">{totalProducts}</strong>
          <span className="metric-sub">{healthyStockCount} items above reorder threshold</span>
        </div>

        <div className="metric-card metric-teal">
          <span className="metric-label">Total Inventory Value</span>
          <strong className="metric-value">{formatCurrency(data.total_valuation)}</strong>
          <span className="metric-sub">Calculated from current unit prices</span>
        </div>

        <div className="metric-card metric-amber">
          <span className="metric-label">Low Stock Alerts</span>
          <strong className="metric-value">{lowStockCount}</strong>
          <span className="metric-sub">At or below reorder threshold</span>
        </div>

        <div className="metric-card metric-crimson">
          <span className="metric-label">Out of Stock Items</span>
          <strong className="metric-value">{outOfStockCount}</strong>
          <span className="metric-sub">Requires immediate restocking</span>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="card quick-actions-bar">
        <div>
          <h3>Warehouse Operations</h3>
          <p className="muted-text">Manage product catalog, record stock movements, or export reports.</p>
        </div>
        <div className="action-btn-group">
          <button className="btn btn-primary" onClick={() => onNavigate('movements')}>
            Record Stock In / Out
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('products')}>
            Manage Products
          </button>
          <button className="btn btn-secondary" onClick={() => onNavigate('reports')}>
            View Valuation Reports
          </button>
        </div>
      </div>

      <div className="dashboard-two-col">
        {/* Left: Reorder Alerts */}
        <div className="card">
          <div className="card-header-row">
            <div>
              <h3>Critical Restock Alerts</h3>
              <p className="muted-text">Products at or below their reorder threshold.</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('movements')}>
              Restock Now
            </button>
          </div>

          {alertItems.length === 0 ? (
            <div className="empty-box">All products have healthy stock levels.</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Product</th>
                    <th>Available</th>
                    <th>Threshold</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {alertItems.map((item) => {
                    const st = getStockStatus(item.quantity, item.reorder_threshold);
                    return (
                      <tr key={item.id}>
                        <td className="mono">{item.sku}</td>
                        <td>
                          <strong>{item.name}</strong>
                          <div className="sub-meta">{item.supplier}</div>
                        </td>
                        <td>
                          <strong>{item.quantity}</strong> units
                        </td>
                        <td>{item.reorder_threshold} units</td>
                        <td>
                          <span className={`status-pill ${st.badge}`}>{st.label}</span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right: Recent Stock Movements */}
        <div className="card">
          <div className="card-header-row">
            <div>
              <h3>Recent Stock Movements</h3>
              <p className="muted-text">Latest 5 Stock-In and Stock-Out transactions.</p>
            </div>
            <button className="btn btn-outline btn-sm" onClick={() => onNavigate('movements')}>
              Full History
            </button>
          </div>

          {!data.recent_transactions || data.recent_transactions.length === 0 ? (
            <div className="empty-box">No stock transactions recorded yet.</div>
          ) : (
            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Product</th>
                    <th>Qty</th>
                    <th>Timestamp</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_transactions.map((tx) => {
                    const isIn = tx.transaction_type === 'IN';
                    return (
                      <tr key={tx.id}>
                        <td>
                          <span className={`status-pill ${isIn ? 'badge-emerald' : 'badge-amber'}`}>
                            {isIn ? 'STOCK IN' : 'STOCK OUT'}
                          </span>
                        </td>
                        <td>
                          <strong>{tx.name}</strong>
                          <div className="sub-meta">{tx.sku}</div>
                        </td>
                        <td>
                          <strong>
                            {isIn ? `+${tx.quantity}` : `-${tx.quantity}`}
                          </strong>
                        </td>
                        <td className="sub-meta">{formatDateTime(tx.transaction_date)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}