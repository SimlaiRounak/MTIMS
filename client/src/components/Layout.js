import React, { useState, useRef, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import { useNotifications } from '../context/NotificationContext';
import {
  Menu, Package, LayoutDashboard, ShoppingCart, Factory, ClipboardList,
  TrendingUp, AlertTriangle, Sun, Moon, LogOut, User, Wifi, WifiOff, Bell,
  CheckCheck, Trash2, BellOff, Info, X,
} from 'lucide-react';
import { Shield } from 'lucide-react';
import { hasAnyRole } from '../utils/rbac';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

const getIcon = (type) => {
  switch (type) {
    case 'low-stock': return <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />;
    case 'order': return <ShoppingCart size={16} style={{ color: 'var(--primary)' }} />;
    case 'purchase-order': return <ClipboardList size={16} style={{ color: 'var(--success)' }} />;
    case 'stock': return <Package size={16} style={{ color: 'var(--warning)' }} />;
    default: return <Info size={16} style={{ color: 'var(--gray-500)' }} />;
  }
};

const formatTime = (timestamp) => {
  const diffMs = Date.now() - new Date(timestamp);
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDay = Math.floor(diffMs / 86400000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return new Date(timestamp).toLocaleDateString();
};

const Layout = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { isDark, toggleTheme } = useTheme();
  const { notifications, unreadCount, markRead, markAllRead, remove, clearAll } = useNotifications();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [popupOpen, setPopupOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const popupRef = useRef(null);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Close popup on outside click
  useEffect(() => {
    const handler = (e) => {
      if (popupRef.current && !popupRef.current.contains(e.target)) {
        setPopupOpen(false);
      }
    };
    if (popupOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [popupOpen]);

  const handleNotificationClick = (n) => {
    markRead(n.id);
    if (n.link) {
      navigate(n.link);
      setPopupOpen(false);
      setModalOpen(false);
    }
  };

  const recentNotifications = notifications.slice(0, 5);

  return (
    <div className="app-layout">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <Menu size={20} />
      </button>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="sidebar-header-top">
            <h1>MTIMS</h1>
            <div className="notif-btn-wrap notif-btn-header" ref={popupRef}>
              <button className="profile-menu-btn" onClick={() => setPopupOpen(!popupOpen)} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Notifications">
                <Bell size={18} />
                {unreadCount > 0 && <span className="notif-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
              </button>

              {/* Notification Popup */}
              {popupOpen && (
                <div className="notif-popup notif-popup-down">
                  <div className="notif-popup-header">
                    <span className="notif-popup-title">Notifications</span>
                    {unreadCount > 0 && (
                      <button className="notif-popup-action" onClick={markAllRead}>Mark all read</button>
                    )}
                  </div>
                  <div className="notif-popup-list">
                    {recentNotifications.length === 0 ? (
                      <div className="notif-popup-empty">
                        <BellOff size={24} style={{ color: 'var(--gray-400)', marginBottom: 6 }} />
                        <span>No notifications yet</span>
                      </div>
                    ) : (
                      recentNotifications.map((n) => (
                        <div
                          key={n.id}
                          className={`notif-popup-item ${n.read ? '' : 'unread'}`}
                          onClick={() => handleNotificationClick(n)}
                          style={{ cursor: n.link ? 'pointer' : 'default' }}
                        >
                          <div className="notif-popup-icon">{getIcon(n.type)}</div>
                          <div className="notif-popup-content">
                            <div className="notif-popup-item-title">{n.title}</div>
                            <div className="notif-popup-msg">{n.message}</div>
                            <div className="notif-popup-time">{formatTime(n.timestamp)}</div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {notifications.length > 0 && (
                    <div className="notif-popup-footer">
                      <button className="notif-popup-viewall" onClick={() => { setPopupOpen(false); setModalOpen(true); }}>
                        View All ({notifications.length})
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          <div className="tenant-name">{user?.tenantName}</div>
        </div>

        <nav className="sidebar-nav" onClick={() => setSidebarOpen(false)}>
          <NavLink to="/" end><LayoutDashboard size={18} /> Dashboard</NavLink>
          <NavLink to="/products"><Package size={18} /> Products</NavLink>
          <NavLink to="/orders"><ShoppingCart size={18} /> Orders</NavLink>
          <NavLink to="/suppliers"><Factory size={18} /> Suppliers</NavLink>
          <NavLink to="/purchase-orders"><ClipboardList size={18} /> Purchase Orders</NavLink>
          <NavLink to="/stock-movements"><TrendingUp size={18} /> Stock Movements</NavLink>
          <NavLink to="/low-stock"><AlertTriangle size={18} /> Low Stock Alerts</NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="sidebar-profile-row">
              <div className="profile-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="profile-name">{user?.name}</span>
              <span className={`status-dot ${connected ? 'online' : 'offline'}`} data-tooltip-id="sidebar-tooltip" data-tooltip-content={connected ? 'Online' : 'Offline'} />
            </div>
            <div className="sidebar-profile-menu">
              <button className="profile-menu-btn" onClick={() => navigate('/profile')} data-tooltip-id="sidebar-tooltip" data-tooltip-content="My Profile">
                <User size={16} />
              </button>

              {hasAnyRole(user, ['owner','manager']) && (
                <button className="profile-menu-btn" onClick={() => navigate('/roles')} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Roles & Permissions">
                  <Shield size={16} />
                </button>
              )}

              <button className="profile-menu-btn" onClick={toggleTheme} data-tooltip-id="sidebar-tooltip" data-tooltip-content={`Switch to ${isDark ? 'Light Mode' : 'Dark Mode'}`}>
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button className="profile-menu-btn logout" onClick={handleLogout} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Logout">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <Tooltip id="sidebar-tooltip" place="top" />

      {/* Full Notifications Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="notif-modal" onClick={(e) => e.stopPropagation()}>
            <div className="notif-modal-header">
              <h3><Bell size={20} style={{ marginRight: 8 }} /> All Notifications</h3>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {unreadCount > 0 && (
                  <button className="btn btn-outline btn-sm" onClick={markAllRead}>
                    <CheckCheck size={14} style={{ marginRight: 4 }} /> Mark all read
                  </button>
                )}
                {notifications.length > 0 && (
                  <button className="btn btn-outline btn-sm" onClick={clearAll}>
                    <Trash2 size={14} style={{ marginRight: 4 }} /> Clear all
                  </button>
                )}
                <button className="modal-close" onClick={() => setModalOpen(false)}><X size={18} /></button>
              </div>
            </div>
            <div className="notif-modal-body">
              {notifications.length === 0 ? (
                <div className="notif-popup-empty" style={{ padding: 40 }}>
                  <BellOff size={40} style={{ color: 'var(--gray-400)', marginBottom: 10 }} />
                  <span>No notifications</span>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`notification-item ${n.read ? 'read' : 'unread'}`}
                    onClick={() => handleNotificationClick(n)}
                    style={{ cursor: n.link ? 'pointer' : 'default' }}
                  >
                    <div className="notification-icon">{getIcon(n.type)}</div>
                    <div className="notification-content">
                      <div className="notification-title">{n.title}</div>
                      <div className="notification-message">{n.message}</div>
                      <div className="notification-time">{formatTime(n.timestamp)}</div>
                    </div>
                    <div className="notification-actions">
                      {!n.read && (
                        <button className="table-action-btn view" onClick={(e) => { e.stopPropagation(); markRead(n.id); }} title="Mark read">
                          <CheckCheck size={14} />
                        </button>
                      )}
                      <button className="table-action-btn delete" onClick={(e) => { e.stopPropagation(); remove(n.id); }} title="Remove">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
