import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { purchaseOrdersAPI, suppliersAPI, productsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import toast from 'react-hot-toast';

const statusBadge = (status) => {
  const map = {
    draft: 'badge-gray', sent: 'badge-info', confirmed: 'badge-info',
    partially_received: 'badge-warning', received: 'badge-success', cancelled: 'badge-danger',
  };
  return <span className={`badge ${map[status] || 'badge-gray'}`}>{status.replace('_', ' ')}</span>;
};

const PurchaseOrders = () => {
  const navigate = useNavigate();
  const { canManage } = useAuth();
  const [pos, setPos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [showModal, setShowModal] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [variants, setVariants] = useState([]);
  const [form, setForm] = useState({
    supplierId: '', expectedDeliveryDate: '', notes: '', items: [{ variantId: '', productId: '', quantityOrdered: 1, unitPrice: 0 }],
  });

  const fetchPOs = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (statusFilter) params.status = statusFilter;
      const { data } = await purchaseOrdersAPI.getAll(params);
      setPos(data.purchaseOrders);
      setTotalPages(data.pagination?.pages || 1);
    } catch {
      toast.error('Failed to load purchase orders');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => { fetchPOs(); }, [fetchPOs]);

  const openCreate = async () => {
    try {
      const [supRes, prodRes] = await Promise.all([
        suppliersAPI.getAll({ limit: 100 }),
        productsAPI.getAll({ limit: 100 }),
      ]);
      setSuppliers(supRes.data.suppliers);
      const allVariants = [];
      (prodRes.data.products || []).forEach((p) => {
        (p.variants || []).forEach((v) => {
          allVariants.push({ ...v, productName: p.name, productId: p._id });
        });
      });
      setVariants(allVariants);
      setForm({ supplierId: '', expectedDeliveryDate: '', notes: '', items: [{ variantId: '', productId: '', quantityOrdered: 1, unitPrice: 0 }] });
      setShowModal(true);
    } catch {
      toast.error('Failed to load data for PO creation');
    }
  };

  const addItem = () => {
    setForm({ ...form, items: [...form.items, { variantId: '', productId: '', quantityOrdered: 1, unitPrice: 0 }] });
  };
  const removeItem = (idx) => {
    if (form.items.length <= 1) return;
    setForm({ ...form, items: form.items.filter((_, i) => i !== idx) });
  };
  const updateItem = (idx, field, value) => {
    const items = [...form.items];
    items[idx] = { ...items[idx], [field]: value };
    if (field === 'variantId') {
      const v = variants.find((vr) => vr._id === value);
      if (v) { items[idx].productId = v.productId; items[idx].unitPrice = v.costPrice || 0; }
    }
    setForm({ ...form, items });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.supplierId) return toast.error('Select a supplier');
    if (form.items.some((it) => !it.variantId || it.quantityOrdered < 1)) return toast.error('Fill all item fields');
    try {
      await purchaseOrdersAPI.create(form);
      toast.success('Purchase Order created');
      setShowModal(false);
      fetchPOs();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create PO');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Purchase Orders</h2>
        {canManage && <button className="btn btn-primary" onClick={openCreate}>+ Create PO</button>}
      </div>

      <div className="card">
        <div className="filter-bar">
          <select className="form-control" value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
            <option value="">All Statuses</option>
            {['draft', 'sent', 'confirmed', 'partially_received', 'received', 'cancelled'].map((s) => (
              <option key={s} value={s}>{s.replace('_', ' ')}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : pos.length === 0 ? (
          <div className="empty-state"><h3>No purchase orders</h3><p>Create a purchase order for your suppliers.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>PO Number</th><th>Supplier</th><th>Items</th><th>Total</th><th>Status</th><th>Expected</th><th>Created</th></tr>
              </thead>
              <tbody>
                {pos.map((po) => (
                  <tr key={po._id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/purchase-orders/${po._id}`)}>
                    <td><strong>{po.poNumber}</strong></td>
                    <td>{po.supplierId?.name || '—'}</td>
                    <td>{po.items?.length || 0}</td>
                    <td>${po.totalAmount?.toFixed(2)}</td>
                    <td>{statusBadge(po.status)}</td>
                    <td>{po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '—'}</td>
                    <td>{new Date(po.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="pagination">
            <button className="btn btn-outline btn-sm" disabled={page === 1} onClick={() => setPage(page - 1)}>Previous</button>
            <span>Page {page} of {totalPages}</span>
            <button className="btn btn-outline btn-sm" disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
          </div>
        )}
      </div>

      <Modal isOpen={showModal} onClose={() => setShowModal(false)} title="Create Purchase Order">
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>Supplier *</label>
              <select className="form-control" value={form.supplierId} onChange={(e) => setForm({ ...form, supplierId: e.target.value })} required>
                <option value="">Select supplier</option>
                {suppliers.map((s) => <option key={s._id} value={s._id}>{s.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label>Expected Delivery</label>
              <input className="form-control" type="date" value={form.expectedDeliveryDate} onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })} />
            </div>
          </div>

          <h4 style={{ marginTop: 8, marginBottom: 8 }}>Items</h4>
          {form.items.map((item, idx) => (
            <div key={idx} className="form-row" style={{ alignItems: 'flex-end', gap: 8, marginBottom: 8 }}>
              <div className="form-group" style={{ flex: 3 }}>
                <label>Variant</label>
                <select className="form-control" value={item.variantId} onChange={(e) => updateItem(idx, 'variantId', e.target.value)} required>
                  <option value="">Select variant</option>
                  {variants.map((v) => (
                    <option key={v._id} value={v._id}>{v.productName} - {v.sku} (Stock: {v.stock})</option>
                  ))}
                </select>
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Qty</label>
                <input className="form-control" type="number" min="1" value={item.quantityOrdered}
                  onChange={(e) => updateItem(idx, 'quantityOrdered', parseInt(e.target.value) || 1)} required />
              </div>
              <div className="form-group" style={{ flex: 1 }}>
                <label>Unit Price</label>
                <input className="form-control" type="number" min="0" step="0.01" value={item.unitPrice}
                  onChange={(e) => updateItem(idx, 'unitPrice', parseFloat(e.target.value) || 0)} required />
              </div>
              {form.items.length > 1 && (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => removeItem(idx)}>×</button>
              )}
            </div>
          ))}
          <button type="button" className="btn btn-outline btn-sm" onClick={addItem}>+ Add Item</button>

          <div className="form-group" style={{ marginTop: 12 }}>
            <label>Notes</label>
            <textarea className="form-control" rows="2" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => setShowModal(false)}>Cancel</button>
            <button type="submit" className="btn btn-primary">Create PO</button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default PurchaseOrders;
