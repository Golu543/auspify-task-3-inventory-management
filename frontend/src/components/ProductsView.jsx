import React, { useEffect, useState } from 'react';
import { api, formatCurrency, getStockStatus } from '../api.js';
import { PlusIcon, SearchIcon } from './Icons.jsx';

const DEFAULT_CATEGORIES = [
  'Laptops',
  'Monitors',
  'Peripherals',
  'Networking',
  'Storage',
  'Accessories',
  'Audio'
];

const INITIAL_FORM = {
  sku: '',
  name: '',
  category: 'Peripherals',
  supplier: '',
  unit_price: '',
  quantity: 0,
  reorder_threshold: 5
};

export default function ProductsView({ notify }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState(INITIAL_FORM);

  const loadProducts = async () => {
    setLoading(true);
    try {
      const res = await api.getProducts(search, categoryFilter, statusFilter);
      setProducts(res.data);
      if (res.categories && res.categories.length > 0) {
        setCategories(Array.from(new Set([...DEFAULT_CATEGORIES, ...res.categories])));
      }
    } catch (err) {
      notify('error', err.message || 'Failed to load products.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProducts();
  }, [search, categoryFilter, statusFilter]);

  const openAddModal = () => {
    setEditingProduct(null);
    setFormData(INITIAL_FORM);
    setIsModalOpen(true);
  };

  const openEditModal = (product) => {
    setEditingProduct(product);
    setFormData({
      sku: product.sku,
      name: product.name,
      category: product.category,
      supplier: product.supplier,
      unit_price: product.unit_price,
      quantity: product.quantity,
      reorder_threshold: product.reorder_threshold
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...formData,
        unit_price: Number(formData.unit_price),
        quantity: Number(formData.quantity),
        reorder_threshold: Number(formData.reorder_threshold)
      };

      if (editingProduct) {
        const res = await api.updateProduct(editingProduct.id, payload);
        notify('success', res.message);
      } else {
        const res = await api.createProduct(payload);
        notify('success', res.message);
      }
      setIsModalOpen(false);
      loadProducts();
    } catch (err) {
      notify('error', err.message);
    }
  };

  const handleDelete = async (product) => {
    if (!window.confirm(`Delete "${product.name}" (SKU: ${product.sku})?`)) return;
    try {
      const res = await api.deleteProduct(product.id);
      notify('success', res.message);
      loadProducts();
    } catch (err) {
      notify('error', err.message);
    }
  };

  return (
    <div className="view-section">
      <div className="card">
        <div className="toolbar-row">
          <div className="search-filter-group">
            <div className="input-with-icon">
              <SearchIcon />
              <input
                type="text"
                placeholder="Search by product name, SKU, or supplier..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search products"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter by category"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter by stock status"
            >
              <option value="">All Stock Statuses</option>
              <option value="in">In Stock (Healthy)</option>
              <option value="low">Low Stock</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>

          <button className="btn btn-primary" onClick={openAddModal}>
            <PlusIcon /> Add Product
          </button>
        </div>

        {loading ? (
          <div className="empty-box">Loading product catalog...</div>
        ) : products.length === 0 ? (
          <div className="empty-box">No products found matching your search or filter criteria.</div>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Product Name & Supplier</th>
                  <th>Category</th>
                  <th>Unit Price</th>
                  <th>Stock Qty</th>
                  <th>Reorder Level</th>
                  <th>Total Value</th>
                  <th>Stock Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => {
                  const st = getStockStatus(p.quantity, p.reorder_threshold);
                  const totalVal = Number(p.quantity) * Number(p.unit_price);
                  return (
                    <tr key={p.id}>
                      <td className="mono">{p.sku}</td>
                      <td>
                        <strong>{p.name}</strong>
                        <div className="sub-meta">Supplier: {p.supplier}</div>
                      </td>
                      <td>{p.category}</td>
                      <td>{formatCurrency(p.unit_price)}</td>
                      <td>
                        <strong>{p.quantity}</strong>
                      </td>
                      <td>{p.reorder_threshold}</td>
                      <td>
                        <strong>{formatCurrency(totalVal)}</strong>
                      </td>
                      <td>
                        <span className={`status-pill ${st.badge}`}>{st.label}</span>
                      </td>
                      <td>
                        <div className="row-actions">
                          <button
                            className="btn-action btn-action-teal"
                            onClick={() => openEditModal(p)}
                          >
                            Edit
                          </button>
                          <button
                            className="btn-action btn-action-danger"
                            onClick={() => handleDelete(p)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Product Modal */}
      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingProduct ? 'Edit Product Details' : 'Add New Product to Inventory'}</h3>
              <button className="close-btn" onClick={() => setIsModalOpen(false)}>
                ×
              </button>
            </div>

            <form onSubmit={handleSubmit} className="modal-form">
              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="sku">SKU Code *</label>
                  <input
                    id="sku"
                    type="text"
                    placeholder="e.g., TECH-SSD-201"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="category">Category *</label>
                  <input
                    id="category"
                    list="cat-list"
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                    required
                  />
                  <datalist id="cat-list">
                    {categories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
              </div>

              <div className="form-field">
                <label htmlFor="name">Product Name *</label>
                <input
                  id="name"
                  type="text"
                  placeholder="e.g., Crucial P5 Plus 2TB NVMe"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="supplier">Supplier Name *</label>
                  <input
                    id="supplier"
                    type="text"
                    placeholder="e.g., Micron Technology"
                    value={formData.supplier}
                    onChange={(e) => setFormData({ ...formData, supplier: e.target.value })}
                    required
                  />
                </div>
                <div className="form-field">
                  <label htmlFor="unit_price">Unit Price ($) *</label>
                  <input
                    id="unit_price"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="129.99"
                    value={formData.unit_price}
                    onChange={(e) => setFormData({ ...formData, unit_price: e.target.value })}
                    required
                  />
                </div>
              </div>

              <div className="form-grid-2">
                <div className="form-field">
                  <label htmlFor="quantity">
                    {editingProduct ? 'Current Stock (Managed via Stock In/Out)' : 'Initial Quantity *'}
                  </label>
                  <input
                    id="quantity"
                    type="number"
                    min="0"
                    value={formData.quantity}
                    onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                    disabled={Boolean(editingProduct)}
                    required
                  />
                </div>

                <div className="form-field">
                  <label htmlFor="reorder_threshold">Reorder Threshold *</label>
                  <input
                    id="reorder_threshold"
                    type="number"
                    min="0"
                    value={formData.reorder_threshold}
                    onChange={(e) =>
                      setFormData({ ...formData, reorder_threshold: e.target.value })
                    }
                    required
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="submit" className="btn btn-primary">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}