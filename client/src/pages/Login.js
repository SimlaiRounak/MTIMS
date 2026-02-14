import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';
import toast from 'react-hot-toast';

const Login = () => {
  const { login } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      toast.success('Welcome back!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-image" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/bg-stock-image.jpg)` }}>
        <div className="auth-image-text">
          <h2>Welcome Back</h2>
          <p>Manage your inventory, suppliers, and orders — all in one place.</p>
        </div>
      </div>
      <div className="auth-form-side">
        <button className="auth-theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {isDark ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <div className="auth-content">
          <h1>MTIMS</h1>
          <p className="subtitle">Multi-Tenant Inventory Management System</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="Enter your email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password"
              className="form-control"
              placeholder="Enter your password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>

        <div className="switch-link">
          Don't have an account? <Link to="/register">Register your business</Link>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
