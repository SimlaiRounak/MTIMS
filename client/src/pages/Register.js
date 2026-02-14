import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { Sun, Moon, Package } from 'lucide-react';
import toast from 'react-hot-toast';

const Register = () => {
  const { register } = useAuth();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [form, setForm] = useState({ tenantName: '', name: '', email: '', password: '' });
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await register(form);
      toast.success('Business registered successfully!');
      navigate('/');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="auth-image" style={{ backgroundImage: `url(${process.env.PUBLIC_URL}/bg-stock-image.jpg)` }}>
        <div className="auth-image-text">
          <h2>Get Started</h2>
          <p>Create your business account and start managing inventory with full multi-tenant isolation.</p>
        </div>
      </div>
      <div className="auth-form-side">
        <button className="auth-theme-toggle" onClick={toggleTheme} title="Toggle theme">
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <div className="auth-content">
          <h1><Package size={24} style={{ verticalAlign: 'middle', marginRight: 8 }} />MTIMS</h1>
          <p className="subtitle">Register your business</p>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Business Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="e.g., My Electronics Store"
              value={form.tenantName}
              onChange={(e) => setForm({ ...form, tenantName: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Your Name</label>
            <input
              type="text"
              className="form-control"
              placeholder="Full name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              className="form-control"
              placeholder="you@company.com"
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
              placeholder="Min 6 characters"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={loading}>
            {loading ? 'Registering...' : 'Register Business'}
          </button>
        </form>

        <div className="switch-link">
          Already have an account? <Link to="/login">Login</Link>
        </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
