import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors globally
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

// Auth
export const authAPI = {
  login: (data) => api.post('/auth/login', data),
  register: (data) => api.post('/auth/register', data),
  getMe: () => api.get('/auth/me'),
  createUser: (data) => api.post('/auth/users', data),
};

// Products
export const productsAPI = {
  getAll: (params) => api.get('/products', { params }),
  get: (id) => api.get(`/products/${id}`),
  create: (data) => api.post('/products', data),
  update: (id, data) => api.put(`/products/${id}`, data),
  delete: (id) => api.delete(`/products/${id}`),
  addVariant: (productId, data) => api.post(`/products/${productId}/variants`, data),
  updateVariant: (id, data) => api.put(`/products/variants/${id}`, data),
  deleteVariant: (id) => api.delete(`/products/variants/${id}`),
  getCategories: () => api.get('/products/categories'),
};

// Stock
export const stockAPI = {
  adjust: (data) => api.post('/stock/adjust', data),
  getMovements: (params) => api.get('/stock/movements', { params }),
  getLowStock: () => api.get('/stock/low-stock'),
};

// Orders
export const ordersAPI = {
  getAll: (params) => api.get('/orders', { params }),
  get: (id) => api.get(`/orders/${id}`),
  create: (data) => api.post('/orders', data),
  updateStatus: (id, data) => api.put(`/orders/${id}/status`, data),
  cancel: (id, data) => api.post(`/orders/${id}/cancel`, data),
};

// Suppliers
export const suppliersAPI = {
  getAll: (params) => api.get('/suppliers', { params }),
  get: (id) => api.get(`/suppliers/${id}`),
  create: (data) => api.post('/suppliers', data),
  update: (id, data) => api.put(`/suppliers/${id}`, data),
  delete: (id) => api.delete(`/suppliers/${id}`),
};

// Purchase Orders
export const purchaseOrdersAPI = {
  getAll: (params) => api.get('/purchase-orders', { params }),
  get: (id) => api.get(`/purchase-orders/${id}`),
  create: (data) => api.post('/purchase-orders', data),
  updateStatus: (id, data) => api.put(`/purchase-orders/${id}/status`, data),
  receive: (id, data) => api.post(`/purchase-orders/${id}/receive`, data),
};

// Dashboard
export const dashboardAPI = {
  getSummary: () => api.get('/dashboard/summary'),
  getTopSellers: () => api.get('/dashboard/top-sellers'),
  getStockMovements: () => api.get('/dashboard/stock-movements'),
};

export default api;
