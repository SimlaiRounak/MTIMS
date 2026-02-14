import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { useTheme } from '../context/ThemeContext';
import {
  Menu, Package, LayoutDashboard, ShoppingCart, Factory, ClipboardList,
  TrendingUp, AlertTriangle, Sun, Moon, LogOut, User, Wifi, WifiOff,
} from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import 'react-tooltip/dist/react-tooltip.css';

const Layout = () => {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const { isDark, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app-layout">
      <button className="mobile-menu-btn" onClick={() => setSidebarOpen(!sidebarOpen)}>
        <Menu size={20} />
      </button>

      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h1>MTIMS</h1>
          <div className="tenant-name">{user?.tenantName}</div>
        </div>

        <nav className="sidebar-nav" onClick={() => setSidebarOpen(false)}>
          <NavLink to="/" end><LayoutDashboard size={18} /> Dashboard</NavLink>
          <NavLink to="/products"><Package size={18} /> Products</NavLink>
          <NavLink to="/orders"><ShoppingCart size={18} /> Orders</NavLink>
          <NavLink to="/suppliers"><Factory size={18} /> Suppliers</NavLink>
          <NavLink to="/purchase-orders"><ClipboardList size={18} /> Purchase Orders</NavLink>
          <NavLink to="/stock-movements"><TrendingUp size={18} /> Stock Movements</NavLink>
          <NavLink to="/low-stock"><AlertTriangle size={18} /> Low Stock Alerts</NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-profile">
            <div className="sidebar-profile-row">
              <div className="profile-avatar">
                {user?.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <span className="profile-name">{user?.name}</span>
              <span className={`status-dot ${connected ? 'online' : 'offline'}`} data-tooltip-id="sidebar-tooltip" data-tooltip-content={connected ? 'Online' : 'Offline'} />
            </div>
            <div className="sidebar-profile-menu">
              <button className="profile-menu-btn" onClick={() => {}} data-tooltip-id="sidebar-tooltip" data-tooltip-content="My Profile">
                <User size={16} />
              </button>
              <button className="profile-menu-btn" onClick={toggleTheme} data-tooltip-id="sidebar-tooltip" data-tooltip-content={isDark ? 'Light Mode' : 'Dark Mode'}>
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              <button className="profile-menu-btn logout" onClick={handleLogout} data-tooltip-id="sidebar-tooltip" data-tooltip-content="Logout">
                <LogOut size={16} />
              </button>
            </div>
          </div>
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <Tooltip id="sidebar-tooltip" place="top" />
    </div>
  );
};

export default Layout;
