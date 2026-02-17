import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { stockAPI } from '../services/api';
import { useSocket } from '../context/SocketContext';
import { Eye } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import toast from 'react-hot-toast';

const LowStockAlerts = () => {
  const navigate = useNavigate();
  const { socket } = useSocket();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await stockAPI.getLowStock();
      setAlerts(data.alerts || []);
    } catch {
      toast.error('Failed to load low stock alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchAlerts();
    socket.on('stock:low', handler);
    socket.on('stock:updated', handler);
    return () => { socket.off('stock:low', handler); socket.off('stock:updated', handler); };
  }, [socket, fetchAlerts]);

  const severityBadge = (severity) => {
    const map = { critical: 'badge-danger', warning: 'badge-warning' };
    return <span className={`badge ${map[severity] || 'badge-warning'}`}>{severity}</span>;
  };

  const criticalCount = alerts.filter((a) => a.severity === 'critical').length;
  const warningCount = alerts.filter((a) => a.severity === 'warning').length;

  return (
    <div>
      <div className="page-header">
        <h2>Low Stock Alerts</h2>
        <button className="btn btn-outline" onClick={fetchAlerts}>Refresh</button>
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-info">
            <h4>Total Alerts</h4>
            <div className="stat-value">{alerts.length}</div>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--danger)' }}>
          <div className="stat-info">
            <h4>Critical</h4>
            <div className="stat-value" style={{ color: 'var(--danger)' }}>{criticalCount}</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Stock at zero</p>
          </div>
        </div>
        <div className="stat-card" style={{ borderLeft: '4px solid var(--warning)' }}>
          <div className="stat-info">
            <h4>Warning</h4>
            <div className="stat-value" style={{ color: 'var(--warning)' }}>{warningCount}</div>
            <p style={{ fontSize: '0.75rem', color: 'var(--gray-500)' }}>Below threshold</p>
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : alerts.length === 0 ? (
          <div className="empty-state">
            <h3>All stock levels are healthy!</h3>
            <p>No variants are below their low stock threshold.</p>
          </div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Current Stock</th>
                  <th>Threshold</th>
                  <th>Pending PO Qty</th>
                  <th>Net After PO</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {alerts.map((item) => {
                  const currentStock = item.stock ?? 0;
                  const netAfterPO = currentStock + (item.pendingPOQuantity || 0);
                  const stillLow = netAfterPO <= (item.lowStockThreshold || 10);
                  return (
                    <tr key={item._id}>
                      <td>{severityBadge(item.severity)}</td>
                      <td>{item.productId?.name || '—'}</td>
                      <td><span className="badge badge-gray">{item.sku}</span></td>
                      <td>
                        <strong style={{ color: currentStock === 0 ? 'var(--danger)' : 'var(--warning)' }}>
                          {currentStock}
                        </strong>
                      </td>
                      <td>{item.lowStockThreshold}</td>
                      <td>
                        {item.pendingPOQuantity > 0 ? (
                          <span style={{ color: 'var(--info)' }}>+{item.pendingPOQuantity}</span>
                        ) : (
                          <span style={{ color: 'var(--gray-400)' }}>0</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${stillLow ? 'badge-warning' : 'badge-success'}`}>
                          {netAfterPO} {stillLow ? '(still low)' : '(covered)'}
                        </span>
                      </td>
                      <td>
                        <button className="table-action-btn view" onClick={() => navigate(`/products/${item.productId?._id}`)}
                          data-tooltip-id="table-tooltip" data-tooltip-content="View Product">
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {alerts.length > 0 && (
        <div className="card" style={{ marginTop: 16, padding: 16 }}>
          <h4 style={{ marginBottom: 8 }}>Understanding Alerts</h4>
          <ul style={{ paddingLeft: 20, color: 'var(--gray-600)', fontSize: '0.875rem', lineHeight: 1.8 }}>
            <li><strong>Critical:</strong> Stock is at zero — immediate action required.</li>
            <li><strong>Warning:</strong> Stock is below the configured threshold.</li>
            <li><strong>Pending PO Qty:</strong> Quantity from confirmed/sent purchase orders not yet received.</li>
            <li><strong>Net After PO:</strong> Expected stock once pending POs are fully received. Shows "covered" if it will exceed the threshold.</li>
          </ul>
        </div>
      )}
      <Tooltip id="table-tooltip" place="top" />
    </div>
  );
};

export default LowStockAlerts;
