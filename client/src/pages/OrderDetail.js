import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ordersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import toast from 'react-hot-toast';

const statusBadge = (status) => {
  const map = {
    pending: 'badge-warning', confirmed: 'badge-info', processing: 'badge-info',
    shipped: 'badge-info', delivered: 'badge-success', cancelled: 'badge-danger',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
};

const OrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchOrder = useCallback(async () => {
    try {
      const { data } = await ordersAPI.get(id);
      setOrder(data.order);
    } catch (err) {
      toast.error('Order not found');
      navigate('/orders');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchOrder(); }, [fetchOrder]);

  const handleStatusUpdate = async (newStatus) => {
    try {
      await ordersAPI.updateStatus(id, { status: newStatus });
      toast.success(`Order ${newStatus}`);
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleCancel = async () => {
    const reason = window.prompt('Cancellation reason (optional):');
    if (reason === null) return; // User clicked Cancel on prompt
    try {
      await ordersAPI.cancel(id, { reason });
      toast.success('Order cancelled, stock restored');
      fetchOrder();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!order) return null;

  const nextStatus = {
    pending: 'confirmed', confirmed: 'processing', processing: 'shipped', shipped: 'delivered',
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/orders')} style={{ marginBottom: 8 }}>
            ← Back to Orders
          </button>
          <h2>Order {order.orderNumber}</h2>
        </div>
        {!['cancelled', 'delivered'].includes(order.status) && (
          <div className="action-btns">
            {hasPermission(user, 'orders:edit') && nextStatus[order.status] && (
              <button className="btn btn-primary" onClick={() => handleStatusUpdate(nextStatus[order.status])}>
                Mark as {nextStatus[order.status]}
              </button>
            )}
            {hasPermission(user, 'orders:cancel') && (
              <button className="btn btn-danger" onClick={handleCancel}>Cancel Order</button>
            )}
          </div>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-info">
            <h4>Status</h4>
            <div style={{ marginTop: 8 }}>{statusBadge(order.status)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h4>Total Amount</h4>
            <div className="stat-value">${order.totalAmount?.toFixed(2)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h4>Customer</h4>
            <div style={{ marginTop: 4 }}>
              <strong>{order.customerName || 'N/A'}</strong><br />
              <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{order.customerEmail || ''}</span>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h4>Created</h4>
            <div style={{ marginTop: 4 }}>{new Date(order.createdAt).toLocaleString()}</div>
          </div>
        </div>
      </div>

      {order.cancelledAt && (
        <div className="card" style={{ background: 'var(--danger-light)', border: '1px solid var(--danger)' }}>
          <strong>Cancelled:</strong> {new Date(order.cancelledAt).toLocaleString()}
          {order.cancelReason && <span> — {order.cancelReason}</span>}
        </div>
      )}

      <div className="card">
        <div className="card-header">
          <h3>Order Items ({order.items?.length})</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Qty</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {(order.items || []).map((item, i) => (
                <tr key={i}>
                  <td>{item.productName}</td>
                  <td><span className="badge badge-gray">{item.variantSku}</span></td>
                  <td>{item.quantity}</td>
                  <td>${item.unitPrice?.toFixed(2)}</td>
                  <td><strong>${item.total?.toFixed(2)}</strong></td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="4" style={{ textAlign: 'right', fontWeight: 600 }}>Total:</td>
                <td><strong>${order.totalAmount?.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {order.notes && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Notes</h3>
          <p>{order.notes}</p>
        </div>
      )}
    </div>
  );
};

export default OrderDetail;
