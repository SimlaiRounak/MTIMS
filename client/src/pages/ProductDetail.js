import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productsAPI, stockAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { hasPermission } from '../utils/rbac';
import Modal from '../components/Modal';
import { Package, DollarSign, Tag, PackagePlus, Trash2 } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import toast from 'react-hot-toast';

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [adjustForm, setAdjustForm] = useState({ variantId: '', quantity: '', type: 'adjustment', notes: '' });
  const [showAddVariant, setShowAddVariant] = useState(false);
  const [variantForm, setVariantForm] = useState({ sku: '', price: '', costPrice: '', stock: '0' });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({});
  const [submitting, setSubmitting] = useState(false);

  const fetchProduct = useCallback(async () => {
    try {
      const { data } = await productsAPI.get(id);
      setProduct(data.product);
      setEditForm({
        name: data.product.name, description: data.product.description || '',
        category: data.product.category || '', basePrice: data.product.basePrice,
      });
    } catch (err) {
      toast.error('Product not found');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => { fetchProduct(); }, [fetchProduct]);

  const handleUpdate = async () => {
    setSubmitting(true);
    try {
      await productsAPI.update(id, editForm);
      toast.success('Product updated');
      setEditing(false);
      fetchProduct();
    } catch (err) {
      toast.error('Failed to update');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStockAdjust = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await stockAPI.adjust({
        variantId: adjustForm.variantId,
        quantity: parseInt(adjustForm.quantity),
        type: adjustForm.type,
        notes: adjustForm.notes,
      });
      toast.success('Stock adjusted');
      setShowAdjust(false);
      setAdjustForm({ variantId: '', quantity: '', type: 'adjustment', notes: '' });
      fetchProduct();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to adjust stock');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddVariant = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await productsAPI.addVariant(id, {
        sku: variantForm.sku,
        price: parseFloat(variantForm.price) || product.basePrice,
        costPrice: parseFloat(variantForm.costPrice) || 0,
        stock: parseInt(variantForm.stock) || 0,
      });
      toast.success('Variant added');
      setShowAddVariant(false);
      setVariantForm({ sku: '', price: '', costPrice: '', stock: '0' });
      fetchProduct();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add variant');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteVariant = async (variantId, sku) => {
    if (!window.confirm(`Delete variant ${sku}?`)) return;
    try {
      await productsAPI.deleteVariant(variantId);
      toast.success('Variant deleted');
      fetchProduct();
    } catch (err) {
      toast.error('Failed to delete variant');
    }
  };

  if (loading) return <div className="loading-spinner"><div className="spinner" /></div>;
  if (!product) return null;

  const totalStock = (product.variants || []).reduce((s, v) => s + v.stock, 0);
  const totalValue = (product.variants || []).reduce((s, v) => s + v.stock * v.price, 0);

  return (
    <div>
      <div className="page-header">
        <div>
          <button className="btn btn-outline btn-sm" onClick={() => navigate('/products')} style={{ marginBottom: 8 }}>
            ← Back to Products
          </button>
          <h2>{product.name}</h2>
        </div>
        <div className="action-btns">
          {hasPermission(user, 'products:edit') && (
            <button className="btn btn-outline" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel Edit' : '✏️ Edit'}
            </button>
          )}
          {hasPermission(user, 'products:edit') && (
            <button className="btn btn-primary" onClick={() => setShowAddVariant(true)}>+ Add Variant</button>
          )}
          {hasPermission(user, 'stock:adjust') && (
            <button className="btn btn-success" onClick={() => setShowAdjust(true)}><PackagePlus size={16} style={{ marginRight: 4 }} /> Adjust Stock</button>
          )}
        </div>
      </div>

      {/* Product Info */}
      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-icon blue"><Package size={24} /></div>
          <div className="stat-info">
            <h4>Total Stock</h4>
            <div className="stat-value">{totalStock}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon green"><DollarSign size={24} /></div>
          <div className="stat-info">
            <h4>Total Value</h4>
            <div className="stat-value">${totalValue.toFixed(2)}</div>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon yellow"><Tag size={24} /></div>
          <div className="stat-info">
            <h4>Variants</h4>
            <div className="stat-value">{product.variants?.length || 0}</div>
          </div>
        </div>
      </div>

      {/* Edit Form */}
      {editing && (
        <div className="card">
          <h3 style={{ marginBottom: 16 }}>Edit Product</h3>
          <div className="form-row">
            <div className="form-group">
              <label>Name</label>
              <input className="form-control" value={editForm.name}
                onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Category</label>
              <input className="form-control" value={editForm.category}
                onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Base Price</label>
            <input type="number" step="0.01" className="form-control" value={editForm.basePrice}
              onChange={(e) => setEditForm({ ...editForm, basePrice: parseFloat(e.target.value) })} />
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-control" rows={3} value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
          </div>
          <button className="btn btn-primary" onClick={handleUpdate} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* Variants Table */}
      <div className="card">
        <div className="card-header">
          <h3>Variants</h3>
        </div>
        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Attributes</th>
                <th>Price</th>
                <th>Cost</th>
                <th>Stock</th>
                <th>Status</th>
                {hasPermission(user, 'products:delete') && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {(product.variants || []).map((v) => (
                <tr key={v._id}>
                  <td><strong>{v.sku}</strong></td>
                  <td>
                    {v.attributes && typeof v.attributes === 'object'
                      ? Object.entries(v.attributes instanceof Map ? Object.fromEntries(v.attributes) : v.attributes)
                          .map(([k, val]) => `${k}: ${val}`)
                          .join(', ')
                      : '-'}
                  </td>
                  <td>${v.price?.toFixed(2)}</td>
                  <td>${v.costPrice?.toFixed(2)}</td>
                  <td><strong>{v.stock}</strong></td>
                  <td>
                    {v.stock <= 0 ? (
                      <span className="badge badge-danger">Out of Stock</span>
                    ) : v.stock <= v.lowStockThreshold ? (
                      <span className="badge badge-warning">Low Stock</span>
                    ) : (
                      <span className="badge badge-success">In Stock</span>
                    )}
                  </td>
                  {hasPermission(user, 'products:delete') && (
                    <td>
                      <button className="table-action-btn delete" onClick={() => handleDeleteVariant(v._id, v.sku)}
                        data-tooltip-id="table-tooltip" data-tooltip-content="Delete">
                        <Trash2 size={15} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Stock Adjustment Modal */}
      <Modal
        isOpen={showAdjust}
        onClose={() => setShowAdjust(false)}
        title="Adjust Stock"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowAdjust(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleStockAdjust} disabled={submitting}>
              {submitting ? 'Adjusting...' : 'Adjust Stock'}
            </button>
          </>
        }
      >
        <form onSubmit={handleStockAdjust}>
          <div className="form-group">
            <label>Variant</label>
            <select className="form-control" value={adjustForm.variantId}
              onChange={(e) => setAdjustForm({ ...adjustForm, variantId: e.target.value })} required>
              <option value="">Select variant...</option>
              {(product.variants || []).map((v) => (
                <option key={v._id} value={v._id}>{v.sku} (Current: {v.stock})</option>
              ))}
            </select>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Quantity (+/-)</label>
              <input type="number" className="form-control" value={adjustForm.quantity}
                onChange={(e) => setAdjustForm({ ...adjustForm, quantity: e.target.value })} required />
            </div>
            <div className="form-group">
              <label>Type</label>
              <select className="form-control" value={adjustForm.type}
                onChange={(e) => setAdjustForm({ ...adjustForm, type: e.target.value })}>
                <option value="adjustment">Adjustment</option>
                <option value="return">Return</option>
              </select>
            </div>
          </div>
          <div className="form-group">
            <label>Notes</label>
            <input className="form-control" value={adjustForm.notes}
              onChange={(e) => setAdjustForm({ ...adjustForm, notes: e.target.value })} placeholder="Reason for adjustment" />
          </div>
        </form>
      </Modal>

      {/* Add Variant Modal */}
      <Modal
        isOpen={showAddVariant}
        onClose={() => setShowAddVariant(false)}
        title="Add Variant"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowAddVariant(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAddVariant} disabled={submitting}>
              {submitting ? 'Adding...' : 'Add Variant'}
            </button>
          </>
        }
      >
        <form onSubmit={handleAddVariant}>
          <div className="form-group">
            <label>SKU</label>
            <input className="form-control" value={variantForm.sku}
              onChange={(e) => setVariantForm({ ...variantForm, sku: e.target.value })} placeholder="Leave empty to auto-generate" />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Price</label>
              <input type="number" step="0.01" min="0" className="form-control" value={variantForm.price}
                onChange={(e) => setVariantForm({ ...variantForm, price: e.target.value })} placeholder={`${product.basePrice}`} />
            </div>
            <div className="form-group">
              <label>Cost Price</label>
              <input type="number" step="0.01" min="0" className="form-control" value={variantForm.costPrice}
                onChange={(e) => setVariantForm({ ...variantForm, costPrice: e.target.value })} />
            </div>
          </div>
          <div className="form-group">
            <label>Initial Stock</label>
            <input type="number" min="0" className="form-control" value={variantForm.stock}
              onChange={(e) => setVariantForm({ ...variantForm, stock: e.target.value })} />
          </div>
        </form>
      </Modal>
      <Tooltip id="table-tooltip" place="top" />
    </div>
  );
};

export default ProductDetail;
