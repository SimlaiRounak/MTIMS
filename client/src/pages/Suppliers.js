import React, { useState, useEffect, useCallback } from 'react';
import { suppliersAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import Modal from '../components/Modal';
import { Pencil, Trash2 } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import toast from 'react-hot-toast';

const Suppliers = () => {
  const { canManage } = useAuth();
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showModal, setShowModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [form, setForm] = useState({
    name: '', contactPerson: '', email: '', phone: '',
    address: { street: '', city: '', state: '', country: '', zipCode: '' },
  });

  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 10 };
      if (search) params.search = search;
      const { data } = await suppliersAPI.getAll(params);
      setSuppliers(data.suppliers);
      setTotalPages(data.pagination?.pages || 1);
    } catch {
      toast.error('Failed to load suppliers');
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { fetchSuppliers(); }, [fetchSuppliers]);

  const resetForm = () => {
    setForm({ name: '', contactPerson: '', email: '', phone: '', address: { street: '', city: '', state: '', country: '', zipCode: '' } });
    setEditingSupplier(null);
  };

  const openCreate = () => { resetForm(); setShowModal(true); };
  const openEdit = (s) => {
    setEditingSupplier(s);
    setForm({
      name: s.name, contactPerson: s.contactPerson || '', email: s.email || '', phone: s.phone || '',
      address: { street: s.address?.street || '', city: s.address?.city || '', state: s.address?.state || '', country: s.address?.country || '', zipCode: s.address?.zipCode || '' },
    });
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingSupplier) {
        await suppliersAPI.update(editingSupplier._id, form);
        toast.success('Supplier updated');
      } else {
        await suppliersAPI.create(form);
        toast.success('Supplier created');
      }
      setShowModal(false);
      resetForm();
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Operation failed');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this supplier?')) return;
    try {
      await suppliersAPI.delete(id);
      toast.success('Supplier deleted');
      fetchSuppliers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete');
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2>Suppliers</h2>
        {canManage && <button className="btn btn-primary" onClick={openCreate}>+ Add Supplier</button>}
      </div>

      <div className="card">
        <div className="filter-bar">
          <input type="text" placeholder="Search suppliers..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="form-control search-input" />
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : suppliers.length === 0 ? (
          <div className="empty-state"><h3>No suppliers found</h3><p>Add your first supplier to get started.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr><th>Name</th><th>Contact</th><th>Email</th><th>Phone</th><th>Location</th>{canManage && <th>Actions</th>}</tr>
              </thead>
              <tbody>
                {suppliers.map((s) => (
                  <tr key={s._id}>
                    <td><strong>{s.name}</strong></td>
                    <td>{s.contactPerson || '—'}</td>
                    <td>{s.email || '—'}</td>
                    <td>{s.phone || '—'}</td>
                    <td>{[s.address?.city, s.address?.country].filter(Boolean).join(', ') || '—'}</td>
                    {canManage && (
                      <td>
                        <div className="action-btns">
                          <button className="table-action-btn edit" onClick={() => openEdit(s)}
                            data-tooltip-id="table-tooltip" data-tooltip-content="Edit">
                            <Pencil size={15} />
                          </button>
                          <button className="table-action-btn delete" onClick={() => handleDelete(s._id)}
                            data-tooltip-id="table-tooltip" data-tooltip-content="Delete">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    )}
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

      <Modal isOpen={showModal} onClose={() => { setShowModal(false); resetForm(); }}
        title={editingSupplier ? 'Edit Supplier' : 'Add Supplier'}>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Company Name *</label>
            <input className="form-control" type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Contact Person</label>
              <input className="form-control" type="text" value={form.contactPerson} onChange={(e) => setForm({ ...form, contactPerson: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-control" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Phone</label>
            <input className="form-control" type="text" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <h4 style={{ marginTop: 16, marginBottom: 8 }}>Address</h4>
          <div className="form-group">
            <label>Street</label>
            <input className="form-control" type="text" value={form.address.street} onChange={(e) => setForm({ ...form, address: { ...form.address, street: e.target.value } })} />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>City</label>
              <input className="form-control" type="text" value={form.address.city} onChange={(e) => setForm({ ...form, address: { ...form.address, city: e.target.value } })} />
            </div>
            <div className="form-group">
              <label>State</label>
              <input className="form-control" type="text" value={form.address.state} onChange={(e) => setForm({ ...form, address: { ...form.address, state: e.target.value } })} />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Country</label>
              <input className="form-control" type="text" value={form.address.country} onChange={(e) => setForm({ ...form, address: { ...form.address, country: e.target.value } })} />
            </div>
            <div className="form-group">
              <label>Zip Code</label>
              <input className="form-control" type="text" value={form.address.zipCode} onChange={(e) => setForm({ ...form, address: { ...form.address, zipCode: e.target.value } })} />
            </div>
          </div>
          <div className="modal-footer">
            <button type="button" className="btn btn-outline" onClick={() => { setShowModal(false); resetForm(); }}>Cancel</button>
            <button type="submit" className="btn btn-primary">{editingSupplier ? 'Update' : 'Create'}</button>
          </div>
        </form>
      </Modal>
      <Tooltip id="table-tooltip" place="top" />
    </div>
  );
};

export default Suppliers;
