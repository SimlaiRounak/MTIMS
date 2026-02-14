import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { purchaseOrdersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

const statusBadge = (status) => {
  const map = {
    draft: 'badge-gray', sent: 'badge-info', confirmed: 'badge-info',
    partially_received: 'badge-warning', received: 'badge-success', cancelled: 'badge-danger',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status.replace('_', ' ')}</span>;
};

const PurchaseOrderDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [po, setPo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showReceive, setShowReceive] = useState(false);
  const [receiveItems, setReceiveItems] = useState([]);

  const fetchPO = useCallback(async () => {
    try {
      const { data } = await purchaseOrdersAPI.get(id);
      setPo(data.purchaseOrder);
    } catch {
      toast.error('Purchase order not found');
      navigate('/purchase-orders');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchPO(); }, [fetchPO]);

  const handleStatusUpdate = async (newStatus) => {
    try {
      await purchaseOrdersAPI.updateStatus(id, { status: newStatus });
      toast.success(`PO status updated to ${newStatus}`);
      fetchPO();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const openReceive = () => {
    if (!po) return;
    setReceiveItems(
      po.items.map((item) => ({
        variantId: item.variantId?._id || item.variantId,
        quantityReceived: 0,
        maxReceivable: item.quantityOrdered - (item.quantityReceived || 0),
        sku: item.variantId?.sku || 'N/A',
        productName: item.productId?.name || 'Product',
      }))
    );
    setShowReceive(true);
  };

  const handleReceive = async (e) => {
    e.preventDefault();
    const items = receiveItems
      .filter((it) => it.quantityReceived > 0)
      .map(({ variantId, quantityReceived }) => ({ variantId, quantityReceived }));

    if (items.length === 0) return toast.error('Enter quantities for at least one item');
    try {
      await purchaseOrdersAPI.receive(id, { items });
      toast.success('Delivery received, stock updated');
      setShowReceive(false);
      fetchPO();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to receive delivery');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!po) return null;

  const canReceive = ['confirmed', 'partially_received'].includes(po.status);
  const statusFlow = { draft: 'sent', sent: 'confirmed' };

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/purchase-orders')} style={{ marginBottom: 8 }}>
            ← Back to Purchase Orders
          </button>
          <h2>PO {po.poNumber}</h2>
        </div>
        {!['received', 'cancelled'].includes(po.status) && (
          <div className="action-btns">
            {hasPermission(user, 'purchase-orders:edit') && statusFlow[po.status] && (
              <button className="btn btn-primary" onClick={() => handleStatusUpdate(statusFlow[po.status])}>
                Mark as {statusFlow[po.status]}
              </button>
            )}
            {hasPermission(user, 'purchase-orders:receive') && canReceive && (
              <button className="btn btn-success" onClick={openReceive} style={{ background: 'var(--success)', color: '#fff' }}>
                Receive Delivery
              </button>
            )}
            {hasPermission(user, 'purchase-orders:edit') && (
              <button className="btn btn-danger" onClick={() => handleStatusUpdate('cancelled')}>Cancel PO</button>
            )}
          </div>
        )}
      </div>

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-info">
            <h4>Status</h4>
            <div style={{ marginTop: 8 }}>{statusBadge(po.status)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h4>Total Amount</h4>
            <div className="stat-value">${po.totalAmount?.toFixed(2)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h4>Supplier</h4>
            <div style={{ marginTop: 4 }}><strong>{po.supplierId?.name || 'Unknown'}</strong></div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-info">
            <h4>Expected Delivery</h4>
            <div style={{ marginTop: 4 }}>{po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : 'Not set'}</div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3>Line Items ({po.items?.length})</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th>SKU</th>
                <th>Ordered</th>
                <th>Received</th>
                <th>Remaining</th>
                <th>Unit Price</th>
                <th>Actual Price</th>
                <th>Line Total</th>
              </tr>
            </thead>
            <tbody>
              {(po.items || []).map((item, i) => {
                const remaining = item.quantityOrdered - (item.quantityReceived || 0);
                return (
                  <tr key={i}>
                    <td>{item.productId?.name || 'Product'}</td>
                    <td><span className="badge badge-gray">{item.variantId?.sku || 'N/A'}</span></td>
                    <td>{item.quantityOrdered}</td>
                    <td>{item.quantityReceived || 0}</td>
                    <td>
                      <span className={`badge ${remaining > 0 ? 'badge-warning' : 'badge-success'}`}>
                        {remaining}
                      </span>
                    </td>
                    <td>${item.unitPrice?.toFixed(2)}</td>
                    <td>{item.actualUnitPrice ? `$${item.actualUnitPrice.toFixed(2)}` : '—'}</td>
                    <td><strong>${(item.quantityOrdered * item.unitPrice).toFixed(2)}</strong></td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr>
                <td colSpan="7" style={{ textAlign: 'right', fontWeight: 600 }}>Total:</td>
                <td><strong>${po.totalAmount?.toFixed(2)}</strong></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {po.notes && (
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>Notes</h3>
          <p>{po.notes}</p>
        </div>
      )}

      <Modal isOpen={showReceive} onClose={() => setShowReceive(false)} title="Receive Delivery">
        <form onSubmit={handleReceive}>
          <p style={{ marginBottom: 16, color: 'var(--gray-500)' }}>
            Enter the quantity received for each item. Leave at 0 for items not yet received.
          </p>
          {receiveItems.map((item, idx) => (
            <div key={idx} className="form-row" style={{ alignItems: 'center', marginBottom: 8 }}>
              <div style={{ flex: 2 }}>
                <strong>{item.productName}</strong><br />
                <span className="badge badge-gray">{item.sku}</span>
                <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginLeft: 8 }}>
                  (max: {item.maxReceivable})
                </span>
              </div>
              <div className="form-group" style={{ flex: 1, marginBottom: 0 }}>
                <input type="number" min="0" max={item.maxReceivable}
                  value={item.quantityReceived}
                  onChange={(e) => {
                    const val = Math.min(parseInt(e.target.value) || 0, item.maxReceivable);
                    const updated = [...receiveItems];
                    updated[idx] = { ...updated[idx], quantityReceived: val };
                    setReceiveItems(updated);
                  }} />
              </div>
            </div>
          ))}
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => setShowReceive(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Confirm Receipt</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PurchaseOrderDetail;
