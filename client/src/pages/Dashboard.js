import React, { useState, useEffect, useCallback } from 'react';
import { dashboardAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { Package, DollarSign, ShoppingCart, AlertTriangle } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell,
} from 'recharts';

const COLORS = ['#1a73e8', '#0f9d58', '#f9ab00', '#d93025', '#ab47bc'];

const Dashboard = () => {
  const [summary, setSummary] = useState(null);
  const [topSellers, setTopSellers] = useState([]);
  const [movementData, setMovementData] = useState([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  const fetchData = useCallback(async () => {
    try {
      const [summaryRes, sellersRes, movementsRes] = await Promise.all([
        dashboardAPI.getSummary(),
        dashboardAPI.getTopSellers(),
        dashboardAPI.getStockMovements(),
      ]);
      setSummary(summaryRes.data);
      setTopSellers(sellersRes.data.topSellers || []);
      setMovementData(movementsRes.data.movements || []);
    } catch (err) {
      console.error('Dashboard fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Refresh on real-time events
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchData();
    socket.on('stock:updated', refresh);
    socket.on('order:created', refresh);
    socket.on('order:cancelled', refresh);
    return () => {
      socket.off('stock:updated', refresh);
      socket.off('order:created', refresh);
      socket.off('order:cancelled', refresh);
    };
  }, [socket, fetchData]);

  if (loading) {
    return <div className="loading-spinner"><div className="spinner" /></div>;
  }

  return (
    <div>
      <div className="page-header">
        <h2>Dashboard</h2>
      </div>

      {/* Stat Cards */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Package size={24} /></div>
          <div className="stat-info">
            <h4>Total Products</h4>
            <div className="stat-value">{summary?.inventory?.totalProducts || 0}</div>
            <div className="stat-sub">{summary?.inventory?.totalVariants || 0} variants</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon green"><DollarSign size={24} /></div>
          <div className="stat-info">
            <h4>Inventory Value</h4>
            <div className="stat-value">${(summary?.inventory?.totalValue || 0).toLocaleString()}</div>
            <div className="stat-sub">{(summary?.inventory?.totalStock || 0).toLocaleString()} units in stock</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon yellow"><ShoppingCart size={24} /></div>
          <div className="stat-info">
            <h4>Orders (30d)</h4>
            <div className="stat-value">{summary?.orders?.totalOrders || 0}</div>
            <div className="stat-sub">${(summary?.orders?.totalRevenue || 0).toLocaleString()} revenue</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon red"><AlertTriangle size={24} /></div>
          <div className="stat-info">
            <h4>Alerts</h4>
            <div className="stat-value">{summary?.alerts?.lowStockItems || 0}</div>
            <div className="stat-sub">low stock items | {summary?.alerts?.pendingPurchaseOrders || 0} pending POs</div>
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="dashboard-grid">
        <div className="card">
          <div className="card-header">
            <h3>Stock Movements (Last 7 Days)</h3>
          </div>
          <div className="chart-container">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={movementData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="purchase" fill="#0f9d58" name="Purchases" />
                <Bar dataKey="sale" fill="#1a73e8" name="Sales" />
                <Bar dataKey="return" fill="#f9ab00" name="Returns" />
                <Bar dataKey="adjustment" fill="#9aa0a6" name="Adjustments" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <h3>Top 5 Sellers (30 Days)</h3>
          </div>
          {topSellers.length > 0 ? (
            <>
              <div className="chart-container" style={{ height: 200 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={topSellers}
                      dataKey="totalQuantity"
                      nameKey="productName"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      label={({ productName, percent }) =>
                        `${productName?.substring(0, 12)} (${(percent * 100).toFixed(0)}%)`
                      }
                    >
                      {topSellers.map((_, index) => (
                        <Cell key={index} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="table-container" style={{ marginTop: 8 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Qty Sold</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topSellers.map((seller, i) => (
                      <tr key={i}>
                        <td>{seller.productName}</td>
                        <td>{seller.totalQuantity}</td>
                        <td>${seller.totalRevenue?.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="empty-state">
              <p>No sales data in the last 30 days</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
