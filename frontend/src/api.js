const API_BASE = 'http://localhost:5002/api';

async function request(endpoint, options = {}) {
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  };

  const response = await fetch(`${API_BASE}${endpoint}`, config);
  const data = await response.json();

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'API request failed.');
  }
  return data;
}

export const api = {
  getDashboard: () => request('/dashboard'),

  getProducts: (search = '', category = '', stockStatus = '') => {
    const params = new URLSearchParams();
    if (search.trim()) params.append('search', search.trim());
    if (category.trim()) params.append('category', category.trim());
    if (stockStatus.trim()) params.append('stock_status', stockStatus.trim());
    return request(`/products?${params.toString()}`);
  },

  createProduct: (payload) =>
    request('/products', { method: 'POST', body: JSON.stringify(payload) }),

  updateProduct: (id, payload) =>
    request(`/products/${id}`, { method: 'PUT', body: JSON.stringify(payload) }),

  deleteProduct: (id) =>
    request(`/products/${id}`, { method: 'DELETE' }),

  getTransactions: () => request('/transactions'),

  recordTransaction: (payload) =>
    request('/transactions', { method: 'POST', body: JSON.stringify(payload) })
};

export function exportToCsv(filename, rows, headers) {
  if (!rows || rows.length === 0) return;

  const escapeCell = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val).replace(/"/g, '""');
    return /[,"\n]/.test(str) ? `"${str}"` : str;
  };

  const csvContent = [
    headers.map((h) => escapeCell(h.label)).join(','),
    ...rows.map((row) => headers.map((h) => escapeCell(row[h.key])).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function formatCurrency(amount) {
  return '$' + Number(amount || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return String(dateStr);
  return d.toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getStockStatus(quantity, threshold) {
  const qty = Number(quantity);
  const thresh = Number(threshold);
  if (qty <= 0) return { label: 'Out of Stock', code: 'out', badge: 'badge-crimson' };
  if (qty <= thresh) return { label: 'Low Stock', code: 'low', badge: 'badge-amber' };
  return { label: 'In Stock', code: 'in', badge: 'badge-emerald' };
}