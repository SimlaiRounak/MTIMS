import React, { useState, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useNavigate } from 'react-router-dom';
import {
  Bell, AlertTriangle, ShoppingCart, ClipboardList, Package,
  Trash2, CheckCheck, BellOff, Info,
} from 'lucide-react';

const STORAGE_KEY = 'mtims-notifications';

const getStoredNotifications = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const saveNotifications = (notifications) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(notifications.slice(0, 100)));
};

const Notifications = () => {
  const { socket, connected } = useSocket();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState(getStoredNotifications);
  const [filter, setFilter] = useState('all');

  const addNotification = useCallback((notification) => {
    setNotifications((prev) => {
      const updated = [notification, ...prev].slice(0, 100);
      saveNotifications(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleLowStock = (data) => {
      addNotification({
        id: Date.now() + Math.random(),
        type: 'low-stock',
        title: 'Low Stock Alert',
        message: `${data.sku} — only ${data.stock} units left`,
        timestamp: new Date().toISOString(),
        read: false,
      });
    };

    const handleOrderCreated = (data) => {
      addNotification({
        id: Date.now() + Math.random(),
        type: 'order',
        title: 'New Order Created',
        message: `Order ${data.order?.orderNumber || 'N/A'} has been placed`,
        timestamp: new Date().toISOString(),
        read: false,
        link: data.order?._id ? `/orders/${data.order._id}` : null,
      });
    };

    const handlePOReceived = (data) => {
      addNotification({
        id: Date.now() + Math.random(),
        type: 'purchase-order',
        title: 'Purchase Order Received',
        message: `PO ${data.purchaseOrder?.poNumber || 'N/A'} has been received`,
        timestamp: new Date().toISOString(),
        read: false,
        link: data.purchaseOrder?._id ? `/purchase-orders/${data.purchaseOrder._id}` : null,
      });
    };

    const handleStockUpdated = (data) => {
      addNotification({
        id: Date.now() + Math.random(),
        type: 'stock',
        title: 'Stock Updated',
        message: `${data.sku || 'A product'} stock has been updated`,
        timestamp: new Date().toISOString(),
        read: false,
      });
    };

    socket.on('stock:low', handleLowStock);
    socket.on('order:created', handleOrderCreated);
    socket.on('po:received', handlePOReceived);
    socket.on('stock:updated', handleStockUpdated);

    return () => {
      socket.off('stock:low', handleLowStock);
      socket.off('order:created', handleOrderCreated);
      socket.off('po:received', handlePOReceived);
      socket.off('stock:updated', handleStockUpdated);
    };
  }, [socket, addNotification]);

  const markAllRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
  };

  const markRead = (id) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      saveNotifications(updated);
      return updated;
    });
  };

  const removeNotification = (id) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      saveNotifications(updated);
      return updated;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    saveNotifications([]);
  };

  const getIcon = (type) => {
    switch (type) {
      case 'low-stock': return <AlertTriangle size={18} style={{ color: 'var(--danger)' }} />;
      case 'order': return <ShoppingCart size={18} style={{ color: 'var(--primary)' }} />;
      case 'purchase-order': return <ClipboardList size={18} style={{ color: 'var(--success)' }} />;
      case 'stock': return <Package size={18} style={{ color: 'var(--warning)' }} />;
      default: return <Info size={18} style={{ color: 'var(--gray-500)' }} />;
    }
  };

  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMin = Math.floor(diffMs / 60000);
    const diffHr = Math.floor(diffMs / 3600000);
    const diffDay = Math.floor(diffMs / 86400000);

    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    if (diffHr < 24) return `${diffHr}h ago`;
    if (diffDay < 7) return `${diffDay}d ago`;
    return date.toLocaleDateString();
  };

  const filtered = filter === 'all'
    ? notifications
    : filter === 'unread'
      ? notifications.filter((n) => !n.read)
      : notifications.filter((n) => n.type === filter);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div>
      <div className="page-header">
        <h2><Bell size={24} style={{ marginRight: 8, verticalAlign: 'middle' }} /> Notifications</h2>
        <div className="action-btns">
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
        </div>
      </div>

      {/* Filter Bar */}
      <div className="filter-bar">
        <select
          className="form-control"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          style={{ width: 200 }}
        >
          <option value="all">All Notifications ({notifications.length})</option>
          <option value="unread">Unread ({unreadCount})</option>
          <option value="low-stock">Low Stock Alerts</option>
          <option value="order">Orders</option>
          <option value="purchase-order">Purchase Orders</option>
          <option value="stock">Stock Updates</option>
        </select>

        {!connected && (
          <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', display: 'flex', alignItems: 'center', gap: 4 }}>
            <BellOff size={14} /> Real-time notifications paused (disconnected)
          </span>
        )}
      </div>

      {/* Notification List */}
      {filtered.length === 0 ? (
        <div className="card empty-state">
          <BellOff size={48} style={{ color: 'var(--gray-400)', marginBottom: 12 }} />
          <h3>No notifications</h3>
          <p style={{ color: 'var(--gray-500)', fontSize: '0.875rem' }}>
            {filter === 'all'
              ? "You're all caught up! Notifications from stock alerts, orders, and purchase orders will appear here."
              : 'No notifications match this filter.'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`notification-item ${n.read ? 'read' : 'unread'}`}
              onClick={() => {
                markRead(n.id);
                if (n.link) navigate(n.link);
              }}
              style={{ cursor: n.link ? 'pointer' : 'default' }}
            >
              <div className="notification-icon">
                {getIcon(n.type)}
              </div>
              <div className="notification-content">
                <div className="notification-title">{n.title}</div>
                <div className="notification-message">{n.message}</div>
                <div className="notification-time">{formatTime(n.timestamp)}</div>
              </div>
              <div className="notification-actions">
                {!n.read && (
                  <button
                    className="table-action-btn view"
                    onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                    title="Mark read"
                  >
                    <CheckCheck size={14} />
                  </button>
                )}
                <button
                  className="table-action-btn delete"
                  onClick={(e) => { e.stopPropagation(); removeNotification(n.id); }}
                  title="Remove"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Notifications;
