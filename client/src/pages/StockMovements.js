import React, { useState, useEffect, useCallback } from 'react';
import { stockAPI } from '../services/api';
import toast from 'react-hot-toast';

const typeBadge = (type) => {
  const map = {
    purchase: 'badge-success', sale: 'badge-info',
    return: 'badge-warning', adjustment: 'badge-gray',
  };
  return <span className={`badge ${map[type] || 'badge-gray'}`}>{type}</span>;
};

const StockMovements = () => {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const fetchMovements = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: 20 };
      if (typeFilter) params.type = typeFilter;
      const { data } = await stockAPI.getMovements(params);
      setMovements(data.movements);
      setTotalPages(data.pagination?.pages || 1);
    } catch {
      toast.error('Failed to load stock movements');
    } finally {
      setLoading(false);
    }
  }, [page, typeFilter]);

  useEffect(() => { fetchMovements(); }, [fetchMovements]);

  return (
    <div>
      <div className="page-header">
        <h2>Stock Movements</h2>
      </div>

      <div className="card">
        <div className="filter-bar">
          <select className="form-control" value={typeFilter} onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}>
            <option value="">All Types</option>
            <option value="purchase">Purchase</option>
            <option value="sale">Sale</option>
            <option value="return">Return</option>
            <option value="adjustment">Adjustment</option>
          </select>
        </div>

        {loading ? (
          <div className="loading-spinner"><div className="spinner" /></div>
        ) : movements.length === 0 ? (
          <div className="empty-state"><h3>No stock movements</h3><p>Stock movements are recorded when orders are placed, deliveries received, or stock adjusted.</p></div>
        ) : (
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th>Product</th>
                  <th>SKU</th>
                  <th>Qty</th>
                  <th>Before</th>
                  <th>After</th>
                  <th>Reference</th>
                  <th>Notes</th>
                  <th>By</th>
                </tr>
              </thead>
              <tbody>
                {movements.map((m) => (
                  <tr key={m._id}>
                    <td>{new Date(m.createdAt).toLocaleString()}</td>
                    <td>{typeBadge(m.type)}</td>
                    <td>{m.productId?.name || '—'}</td>
                    <td><span className="badge badge-gray">{m.variantId?.sku || '—'}</span></td>
                    <td>
                      <span style={{ color: m.quantity > 0 ? 'var(--success)' : 'var(--danger)', fontWeight: 600 }}>
                        {m.quantity > 0 ? '+' : ''}{m.quantity}
                      </span>
                    </td>
                    <td>{m.previousStock}</td>
                    <td>{m.newStock}</td>
                    <td>{m.reference || '—'}</td>
                    <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.notes || '—'}
                    </td>
                    <td>{m.createdBy?.name || '—'}</td>
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
    </div>
  );
};

export default StockMovements;
