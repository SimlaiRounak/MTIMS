import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ordersAPI, productsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Modal from '../components/Modal';
import { ShoppingCart, Eye } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import toast from 'react-hot-toast';

const statusBadge = (status) => {
  const map = {
    pending: 'badge-warning', confirmed: 'badge-info', processing: 'badge-info',
    shipped: 'badge-info', delivered: 'badge-success', cancelled: 'badge-danger',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status}</span>;
};

const Orders = () => {
  const { canManage } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // Create order state
  const [showCreate, setShowCreate] = useState(false);
  const [products, setProducts] = useState([]);
  const [orderForm, setOrderForm] = useState({
    customerName: '', customerEmail: '', notes: '',
    items: [{ variantId: '', quantity: 1 }],
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchOrders = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await ordersAPI.getAll(params);
      setOrders(data.orders);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchOrders(pagination.page);
    socket.on('order:created', refresh);
    socket.on('order:updated', refresh);
    socket.on('order:cancelled', refresh);
    return () => {
      socket.off('order:created', refresh);
      socket.off('order:updated', refresh);
      socket.off('order:cancelled', refresh);
    };
  }, [socket, fetchOrders, pagination.page]);

  const openCreateModal = async () => {
    try {
      const { data } = await productsAPI.getAll({ limit: 100 });
      setProducts(data.products);
      setShowCreate(true);
    } catch (err) {
      toast.error('Failed to load products');
    }
  };

  const allVariants = products.flatMap((p) =>
    (p.variants || []).map((v) => ({
      ...v,
      productName: p.name,
      productId: p._id,
    }))
  );

  const handleCreateOrder = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const items = orderForm.items
        .filter((i) => i.variantId)
        .map((i) => ({ variantId: i.variantId, quantity: parseInt(i.quantity) }));
      if (items.length === 0) {
        toast.error('Add at least one item');
        setSubmitting(false);
        return;
      }
      await ordersAPI.create({
        items,
        customerName: orderForm.customerName,
        customerEmail: orderForm.customerEmail,
        notes: orderForm.notes,
      });
      toast.success('Order created!');
      setShowCreate(false);
      setOrderForm({ customerName: '', customerEmail: '', notes: '', items: [{ variantId: '', quantity: 1 }] });
      fetchOrders();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Orders</h2>
        <button className="btn btn-primary" onClick={openCreateModal}>+ New Order</button>
      </div>

      <div className="filter-bar">
        <select className="form-control" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={{ width: 180 }}>
          <option value="">All Statuses</option>
          {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : orders.length === 0 ? (
        <div className="card empty-state">
          <ShoppingCart size={48} style={{ color: 'var(--gray-400)', marginBottom: 12 }} />
          <h3>No orders found</h3>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td><strong style={{ cursor: 'pointer', color: 'var(--primary)' }}
                      onClick={() => navigate(`/orders/${order._id}`)}>{order.orderNumber}</strong></td>
                    <td>{order.customerName || '-'}</td>
                    <td>{order.items?.length || 0} items</td>
                    <td><strong>${order.totalAmount?.toFixed(2)}</strong></td>
                    <td>{statusBadge(order.status)}</td>
                    <td>{new Date(order.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button className="table-action-btn view" onClick={() => navigate(`/orders/${order._id}`)}
                        data-tooltip-id="table-tooltip" data-tooltip-content="View">
                        <Eye size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination.pages > 1 && (
            <div className="pagination">
              <button disabled={pagination.page <= 1} onClick={() => fetchOrders(pagination.page - 1)}>← Prev</button>
              <span style={{ fontSize: '0.85rem' }}>Page {pagination.page} of {pagination.pages}</span>
              <button disabled={pagination.page >= pagination.pages} onClick={() => fetchOrders(pagination.page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Create Order Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Order"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreateOrder} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Order'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreateOrder}>
          <div className="form-row">
            <div className="form-group">
              <label>Customer Name</label>
              <input className="form-control" value={orderForm.customerName}
                onChange={(e) => setOrderForm({ ...orderForm, customerName: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Customer Email</label>
              <input type="email" className="form-control" value={orderForm.customerEmail}
                onChange={(e) => setOrderForm({ ...orderForm, customerEmail: e.target.value })} />
            </div>
          </div>

          <h4 style={{ fontSize: '0.9rem', margin: '16px 0 8px' }}>Order Items</h4>
          {orderForm.items.map((item, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '2fr 80px 32px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <div className="form-group">
                <label>Variant</label>
                <select className="form-control" value={item.variantId}
                  onChange={(e) => {
                    const items = [...orderForm.items];
                    items[i].variantId = e.target.value;
                    setOrderForm({ ...orderForm, items });
                  }} required>
                  <option value="">Select...</option>
                  {allVariants.map((v) => (
                    <option key={v._id} value={v._id}>
                      {v.productName} - {v.sku} (Stock: {v.stock}) - ${v.price}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>Qty</label>
                <input type="number" min="1" className="form-control" value={item.quantity}
                  onChange={(e) => {
                    const items = [...orderForm.items];
                    items[i].quantity = e.target.value;
                    setOrderForm({ ...orderForm, items });
                  }} required />
              </div>
              <button type="button" className="btn btn-danger btn-sm" style={{ height: 38 }}
                onClick={() => {
                  if (orderForm.items.length <= 1) return;
                  setOrderForm({ ...orderForm, items: orderForm.items.filter((_, idx) => idx !== i) });
                }} disabled={orderForm.items.length <= 1}>✕</button>
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm"
            onClick={() => setOrderForm({ ...orderForm, items: [...orderForm.items, { variantId: '', quantity: 1 }] })}>
            + Add Item
          </button>

          <div className="form-group" style={{ marginTop: 16 }}>
            <label>Notes</label>
            <input className="form-control" value={orderForm.notes}
              onChange={(e) => setOrderForm({ ...orderForm, notes: e.target.value })} />
          </div>
        </form>
      </Modal>
      <Tooltip id="table-tooltip" place="top" />
    </div>
  );
};

export default Orders;
