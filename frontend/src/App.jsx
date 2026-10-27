import React, { useState } from 'react';
import {
  DashboardIcon,
  BoxIcon,
  MovementIcon,
  ReportIcon
} from './components/Icons.jsx';
import DashboardView from './components/DashboardView.jsx';
import ProductsView from './components/ProductsView.jsx';
import StockMovementView from './components/StockMovementView.jsx';
import ReportsView from './components/ReportsView.jsx';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: DashboardIcon, subtitle: 'Warehouse KPIs, stock alerts, and recent activity' },
  { id: 'products', label: 'Products & Stock', icon: BoxIcon, subtitle: 'Manage SKUs, pricing, suppliers, and reorder levels' },
  { id: 'movements', label: 'Stock In / Out', icon: MovementIcon, subtitle: 'Record stock additions, dispatches, and audit ledger' },
  { id: 'reports', label: 'Reports & CSV', icon: ReportIcon, subtitle: 'Category valuation analytics and CSV exports' }
];

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [toast, setToast] = useState({ type: '', message: '' });

  const notify = (type, message) => {
    setToast({ type, message });
    setTimeout(() => {
      setToast({ type: '', message: '' });
    }, 4500);
  };

  const currentNav = NAV_ITEMS.find((item) => item.id === activeTab) || NAV_ITEMS[0];

  return (
    <div className="layout-shell">
      {/* Left Navigation Sidebar */}
      <aside className="sidebar">
        <div className="brand-box">
          <h1 className="brand-title">NexusStock</h1>
          <p className="brand-sub">Inventory Management System</p>
        </div>

        <nav className="sidebar-nav" aria-label="Main Navigation">
          {NAV_ITEMS.map((item) => {
            const IconComponent = item.icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-btn ${activeTab === item.id ? 'active' : ''}`}
                onClick={() => setActiveTab(item.id)}
              >
                <IconComponent />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="sidebar-footer">
          <div className="sys-indicator">
            <span className="dot-online" />
            <span>MySQL80 • Port 5002</span>
          </div>
        </div>
      </aside>

      {/* Main Content Workspace */}
      <div className="workspace">
        <header className="topbar">
          <div>
            <h2>{currentNav.label}</h2>
            <p className="muted-text">{currentNav.subtitle}</p>
          </div>
        </header>

        {toast.message && (
          <div className={`toast-banner ${toast.type === 'error' ? 'toast-error' : 'toast-success'}`}>
            <span>{toast.message}</span>
            <button onClick={() => setToast({ type: '', message: '' })} className="toast-close">
              ×
            </button>
          </div>
        )}

        <main className="content-area">
          {activeTab === 'dashboard' && (
            <DashboardView onNavigate={setActiveTab} notify={notify} />
          )}
          {activeTab === 'products' && <ProductsView notify={notify} />}
          {activeTab === 'movements' && <StockMovementView notify={notify} />}
          {activeTab === 'reports' && <ReportsView notify={notify} />}
        </main>
      </div>
    </div>
  );
}