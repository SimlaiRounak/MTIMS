import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';

const SocketContext = createContext(null);

export const useSocket = () => useContext(SocketContext);

const SOCKET_URL = process.env.REACT_APP_SOCKET_URL || 'http://localhost:5000';

export const SocketProvider = ({ children }) => {
  const { user } = useAuth();
  const [connected, setConnected] = useState(false);
  const socketRef = useRef(null);

  useEffect(() => {
    if (!user) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
        setConnected(false);
      }
      return;
    }

    const token = localStorage.getItem('token');
    if (!token) return;

    const socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      console.log('Socket connected');
      setConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('Socket disconnected');
      setConnected(false);
    });

    // Low stock alerts
    socket.on('stock:low', (data) => {
      toast.error(data.stock === 0 ? `Low stock alert: ${data.sku} — out of stock` : `Low stock alert: ${data.sku} — only ${data.stock} left`, {
        duration: 6000,
      });
    });

    // Order notifications
    socket.on('order:created', (data) => {
      toast.success(`New order: ${data.order.orderNumber}`);
    });

    // PO notifications
    socket.on('po:received', (data) => {
      toast.success(`PO ${data.purchaseOrder.poNumber} received`);
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [user]);

  const value = {
    socket: socketRef.current,
    connected,
  };

  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
};
