import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useSocket } from './SocketContext';

const STORAGE_KEY = 'mtims-notifications';

const getStored = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
};

const save = (list) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, 100)));
};

const NotificationContext = createContext(null);

export const useNotifications = () => useContext(NotificationContext);

export const NotificationProvider = ({ children }) => {
  const { socket } = useSocket();
  const [notifications, setNotifications] = useState(getStored);

  const add = useCallback((notification) => {
    setNotifications((prev) => {
      const updated = [notification, ...prev].slice(0, 100);
      save(updated);
      return updated;
    });
  }, []);

  useEffect(() => {
    if (!socket) return;

    const onLowStock = (data) => {
      add({
        id: Date.now() + Math.random(),
        type: 'low-stock',
        title: 'Low Stock Alert',
        message: data.stock === 0 ? `${data.sku} — out of stock` : `${data.sku} — only ${data.stock} units left`,
        timestamp: new Date().toISOString(),
        read: false,
      });
    };

    const onOrderCreated = (data) => {
      add({
        id: Date.now() + Math.random(),
        type: 'order',
        title: 'New Order Created',
        message: `Order ${data.order?.orderNumber || 'N/A'} has been placed`,
        timestamp: new Date().toISOString(),
        read: false,
        link: data.order?._id ? `/orders/${data.order._id}` : null,
      });
    };

    const onPOReceived = (data) => {
      add({
        id: Date.now() + Math.random(),
        type: 'purchase-order',
        title: 'PO Received',
        message: `PO ${data.purchaseOrder?.poNumber || 'N/A'} received`,
        timestamp: new Date().toISOString(),
        read: false,
        link: data.purchaseOrder?._id ? `/purchase-orders/${data.purchaseOrder._id}` : null,
      });
    };

    const onStockUpdated = (data) => {
      add({
        id: Date.now() + Math.random(),
        type: 'stock',
        title: 'Stock Updated',
        message: `${data.sku || 'A product'} stock updated`,
        timestamp: new Date().toISOString(),
        read: false,
      });
    };

    socket.on('stock:low', onLowStock);
    socket.on('order:created', onOrderCreated);
    socket.on('po:received', onPOReceived);
    socket.on('stock:updated', onStockUpdated);

    return () => {
      socket.off('stock:low', onLowStock);
      socket.off('order:created', onOrderCreated);
      socket.off('po:received', onPOReceived);
      socket.off('stock:updated', onStockUpdated);
    };
  }, [socket, add]);

  const markRead = (id) => {
    setNotifications((prev) => {
      const updated = prev.map((n) => (n.id === id ? { ...n, read: true } : n));
      save(updated);
      return updated;
    });
  };

  const markAllRead = () => {
    setNotifications((prev) => {
      const updated = prev.map((n) => ({ ...n, read: true }));
      save(updated);
      return updated;
    });
  };

  const remove = (id) => {
    setNotifications((prev) => {
      const updated = prev.filter((n) => n.id !== id);
      save(updated);
      return updated;
    });
  };

  const clearAll = () => {
    setNotifications([]);
    save([]);
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <NotificationContext.Provider value={{
      notifications, unreadCount, markRead, markAllRead, remove, clearAll,
    }}>
      {children}
    </NotificationContext.Provider>
  );
};
