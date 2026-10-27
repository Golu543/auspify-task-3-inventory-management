import React, { useEffect, useState } from 'react';
import { api, formatDateTime } from '../api.js';
import { SearchIcon } from './Icons.jsx';

export default function StockMovementView({ notify }) {
  const [products, setProducts] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    product_id: '',
    transaction_type: 'IN',
    quantity: 1,
    remarks: ''
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [prodRes, txRes] = await Promise.all([
        api.getProducts(),
        api.getTransactions()
      ]);
      setProducts(prodRes.data);
      setTransactions(txRes.data);
    } catch (err) {
      notify('error', err.message || 'Failed to load stock movement data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const selectedProduct = products.find((p) => String(p.id) === String(form.product_id));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.product_id) {
      notify('error', 'Please select a product.');
      return;
    }

    try {
      const res = await api.recordTransaction({
        product_id: Number(form.product_id),
        transaction_type: form.transaction_type,
        quantity: Number(form.quantity),
        remarks: form.remarks
      });
      notify('success', res.message);
      setForm({ ...form, quantity: 1, remarks: '' });
      loadData();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const filteredTransactions = transactions.filter((tx) => {
    if (typeFilter && tx.transaction_type !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        tx.name.toLowerCase().includes(q) ||
        tx.sku.toLowerCase().includes(q) ||
        (tx.remarks && tx.remarks.toLowerCase().includes(q))
      );
    }
    return true;
  });

  return (
    <div className="view-section movement-grid">
      {/* Left Card: Stock In / Stock Out Form */}
      <div className="card">
        <h3>Record Stock Movement</h3>
        <p className="muted-text" style={{ marginBottom: '16px' }}>
          Add incoming supplier deliveries (Stock-In) or dispatch units (Stock-Out).
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-field">
            <label>Movement Type *</label>
            <div className="type-toggle-row">
              <button
                type="button"
                className={`toggle-btn ${form.transaction_type === 'IN' ? 'active-in' : ''}`}
                onClick={() => setForm({ ...form, transaction_type: 'IN' })}
              >
                + Stock In (Restock)
              </button>
              <button
                type="button"
                className={`toggle-btn ${form.transaction_type === 'OUT' ? 'active-out' : ''}`}
                onClick={() => setForm({ ...form, transaction_type: 'OUT' })}
              >
                - Stock Out (Dispatch)
              </button>
            </div>
          </div>

          <div className="form-field">
            <label htmlFor="product_id">Select Product *</label>
            <select
              id="product_id"
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              required
            >
              <option value="">-- Choose a product --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.sku}] {p.name} ({p.quantity} available)
                </option>
              ))}
            </select>
          </div>

          {selectedProduct && (
            <div className="helper-note">
              Current Stock: <strong>{selectedProduct.quantity} units</strong> | Reorder Level:{' '}
              <strong>{selectedProduct.reorder_threshold} units</strong>
            </div>
          )}

          <div className="form-field">
            <label htmlFor="qty">Quantity *</label>
            <input
              id="qty"
              type="number"
              min="1"
              max={form.transaction_type === 'OUT' && selectedProduct ? Math.max(1, selectedProduct.quantity) : 10000}
              value={form.quantity}
              onChange={(e) => setForm({ ...form, quantity: e.target.value })}
              required
            />
          </div>

          <div className="form-field">
            <label htmlFor="remarks">Reference / Remarks</label>
            <input
              id="remarks"
              type="text"
              placeholder="e.g., PO #4021 delivery or Client dispatch"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" style={{ marginTop: '6px' }}>
            {form.transaction_type === 'IN' ? 'Confirm Stock-In' : 'Confirm Stock-Out'}
          </button>
        </form>
      </div>

      {/* Right Card: Transaction Ledger */}
      <div className="card">
        <div className="toolbar-row">
          <div className="tab-pills">
            {[
              { id: '', label: 'All Movements' },
              { id: 'IN', label: 'Stock In (+)' },
              { id: 'OUT', label: 'Stock Out (-)' }
            ].map((tab) => (
              <button
                key={tab.id || 'all'}
                type="button"
                className={`tab-pill ${typeFilter === tab.id ? 'active' : ''}`}
                onClick={() => setTypeFilter(tab.id)}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="input-with-icon">
            <SearchIcon />
            <input
              type="text"
              placeholder="Search SKU, product, or remarks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search transactions"
            />
          </div>
        </div>

        {loading ? (
          <div className="empty-box">Loading transaction history...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="empty-box">No stock transactions match your filter.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Type</th>
                  <th>Product & SKU</th>
                  <th>Quantity</th>
                  <th>Remarks</th>
                  <th>Date & Time</th>
                </tr>
              </thead>
              <tbody>
                {filteredTransactions.map((tx) => {
                  const isIn = tx.transaction_type === 'IN';
                  return (
                    <tr key={tx.id}>
                      <td className="mono">#{tx.id}</td>
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
                        <strong>{isIn ? `+${tx.quantity}` : `-${tx.quantity}`}</strong>
                      </td>
                      <td>{tx.remarks || '—'}</td>
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
  );
}