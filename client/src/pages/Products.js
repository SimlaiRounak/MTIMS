import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { productsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import Modal from '../components/Modal';
import { Package, Eye, Trash2 } from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import toast from 'react-hot-toast';

const Products = () => {
  const { canManage } = useAuth();
  const { socket } = useSocket();
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '', description: '', category: '', basePrice: '',
    variants: [{ sku: '', attributes: {}, price: '', costPrice: '', stock: '0' }],
  });
  const [submitting, setSubmitting] = useState(false);

  const fetchProducts = useCallback(async (page = 1) => {
    try {
      setLoading(true);
      const params = { page, limit: 20 };
      if (search) params.search = search;
      if (category) params.category = category;
      const { data } = await productsAPI.getAll(params);
      setProducts(data.products);
      setPagination(data.pagination);
    } catch (err) {
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  }, [search, category]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  useEffect(() => {
    productsAPI.getCategories().then(({ data }) => setCategories(data.categories || [])).catch(() => {});
  }, []);

  // Real-time updates
  useEffect(() => {
    if (!socket) return;
    const refresh = () => fetchProducts(pagination.page);
    socket.on('product:created', refresh);
    socket.on('product:updated', refresh);
    socket.on('product:deleted', refresh);
    socket.on('stock:updated', refresh);
    return () => {
      socket.off('product:created', refresh);
      socket.off('product:updated', refresh);
      socket.off('product:deleted', refresh);
      socket.off('stock:updated', refresh);
    };
  }, [socket, fetchProducts, pagination.page]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        ...createForm,
        basePrice: parseFloat(createForm.basePrice),
        variants: createForm.variants.map((v) => ({
          ...v,
          price: parseFloat(v.price) || parseFloat(createForm.basePrice),
          costPrice: parseFloat(v.costPrice) || 0,
          stock: parseInt(v.stock) || 0,
        })),
      };
      await productsAPI.create(payload);
      toast.success('Product created!');
      setShowCreate(false);
      setCreateForm({
        name: '', description: '', category: '', basePrice: '',
        variants: [{ sku: '', attributes: {}, price: '', costPrice: '', stock: '0' }],
      });
      fetchProducts();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create product');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!window.confirm(`Delete "${name}" and all its variants?`)) return;
    try {
      await productsAPI.delete(id);
      toast.success('Product deleted');
      fetchProducts();
    } catch (err) {
      toast.error('Failed to delete product');
    }
  };

  const addVariantRow = () => {
    setCreateForm({
      ...createForm,
      variants: [...createForm.variants, { sku: '', attributes: {}, price: '', costPrice: '', stock: '0' }],
    });
  };

  const updateVariant = (index, field, value) => {
    const variants = [...createForm.variants];
    variants[index] = { ...variants[index], [field]: value };
    setCreateForm({ ...createForm, variants });
  };

  const removeVariantRow = (index) => {
    if (createForm.variants.length <= 1) return;
    const variants = createForm.variants.filter((_, i) => i !== index);
    setCreateForm({ ...createForm, variants });
  };

  return (
    <div>
      <div className="page-header">
        <h2>Products</h2>
        {canManage && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + New Product
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="filter-bar">
        <input
          type="text"
          className="form-control search-input"
          placeholder="Search products..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select className="form-control" value={category} onChange={(e) => setCategory(e.target.value)} style={{ width: 180 }}>
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Products Table */}
      {loading ? (
        <div className="loading-spinner"><div className="spinner" /></div>
      ) : products.length === 0 ? (
        <div className="card empty-state">
          <Package size={48} style={{ color: 'var(--gray-400)', marginBottom: 12 }} />
          <h3>No products found</h3>
          <p>Create your first product to get started</p>
        </div>
      ) : (
        <div className="card">
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Category</th>
                  <th>Base Price</th>
                  <th>Variants</th>
                  <th>Total Stock</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product._id}>
                    <td>
                      <strong style={{ cursor: 'pointer', color: 'var(--primary)' }}
                        onClick={() => navigate(`/products/${product._id}`)}
                      >
                        {product.name}
                      </strong>
                      {product.description && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--gray-500)', marginTop: 2 }}>
                          {product.description.substring(0, 60)}...
                        </div>
                      )}
                    </td>
                    <td><span className="badge badge-info">{product.category || 'N/A'}</span></td>
                    <td>${product.basePrice?.toFixed(2)}</td>
                    <td>
                      <div className="variant-chips">
                        {(product.variants || []).slice(0, 4).map((v) => (
                          <span key={v._id} className={`variant-chip ${v.stock <= v.lowStockThreshold ? 'low-stock' : ''}`}>
                            {v.sku}: <span className="stock">{v.stock}</span>
                          </span>
                        ))}
                        {(product.variants || []).length > 4 && (
                          <span className="variant-chip">+{product.variants.length - 4} more</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <strong>{product.totalStock || 0}</strong>
                    </td>
                    <td>
                      <div className="action-btns">
                        <button className="table-action-btn view" onClick={() => navigate(`/products/${product._id}`)}
                          data-tooltip-id="table-tooltip" data-tooltip-content="View">
                          <Eye size={15} />
                        </button>
                        {canManage && (
                          <button className="table-action-btn delete" onClick={() => handleDelete(product._id, product.name)}
                            data-tooltip-id="table-tooltip" data-tooltip-content="Delete">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button disabled={pagination.page <= 1} onClick={() => fetchProducts(pagination.page - 1)}>← Prev</button>
              <span style={{ fontSize: '0.85rem', color: 'var(--gray-600)' }}>
                Page {pagination.page} of {pagination.pages}
              </span>
              <button disabled={pagination.page >= pagination.pages} onClick={() => fetchProducts(pagination.page + 1)}>Next →</button>
            </div>
          )}
        </div>
      )}

      {/* Create Product Modal */}
      <Modal
        isOpen={showCreate}
        onClose={() => setShowCreate(false)}
        title="Create Product"
        footer={
          <>
            <button className="btn btn-outline" onClick={() => setShowCreate(false)}>Cancel</button>
            <button className="btn btn-primary" onClick={handleCreate} disabled={submitting}>
              {submitting ? 'Creating...' : 'Create Product'}
            </button>
          </>
        }
      >
        <form onSubmit={handleCreate}>
          <div className="form-group">
            <label>Product Name *</label>
            <input className="form-control" value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} required />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label>Category</label>
              <input className="form-control" value={createForm.category}
                onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })} />
            </div>
            <div className="form-group">
              <label>Base Price *</label>
              <input type="number" step="0.01" min="0" className="form-control" value={createForm.basePrice}
                onChange={(e) => setCreateForm({ ...createForm, basePrice: e.target.value })} required />
            </div>
          </div>
          <div className="form-group">
            <label>Description</label>
            <textarea className="form-control" rows={2} value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </div>

          <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--gray-200)' }} />
          <h4 style={{ fontSize: '0.9rem', marginBottom: 12 }}>Variants</h4>

          {createForm.variants.map((variant, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 80px 32px', gap: 8, marginBottom: 8, alignItems: 'end' }}>
              <div className="form-group">
                <label>SKU</label>
                <input className="form-control" placeholder="Auto-generated" value={variant.sku}
                  onChange={(e) => updateVariant(i, 'sku', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Price</label>
                <input type="number" step="0.01" min="0" className="form-control" placeholder="Base price"
                  value={variant.price} onChange={(e) => updateVariant(i, 'price', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Cost</label>
                <input type="number" step="0.01" min="0" className="form-control"
                  value={variant.costPrice} onChange={(e) => updateVariant(i, 'costPrice', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Stock</label>
                <input type="number" min="0" className="form-control"
                  value={variant.stock} onChange={(e) => updateVariant(i, 'stock', e.target.value)} />
              </div>
              <button type="button" className="btn btn-danger btn-sm" style={{ height: 38 }}
                onClick={() => removeVariantRow(i)} disabled={createForm.variants.length <= 1}>✕</button>
            </div>
          ))}

          <button type="button" className="btn btn-outline btn-sm" onClick={addVariantRow}>
            + Add Variant
          </button>
        </form>
      </Modal>
      <Tooltip id="table-tooltip" place="top" />
    </div>
  );
};

export default Products;
