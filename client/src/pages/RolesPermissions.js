import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { usersAPI, rolesAPI } from '../services/api';
import { ALL_PERMISSIONS, ROLES, isOwner as checkIsOwner } from '../utils/rbac';
import {
  Shield, Users, UserPlus, Pencil, Trash2, Check, X, ChevronDown, ChevronUp,
  ToggleLeft, ToggleRight, Save, RotateCcw,
} from 'lucide-react';
import { Tooltip } from 'react-tooltip';
import toast from 'react-hot-toast';

const RolesPermissions = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [expandedRole, setExpandedRole] = useState(null);
  const [createForm, setCreateForm] = useState({ name: '', email: '', password: '', role: 'staff' });
  const [creating, setCreating] = useState(false);

  // Permission management
  const [rolePermissions, setRolePermissions] = useState({});
  const [originalPermissions, setOriginalPermissions] = useState({});
  const [savingRole, setSavingRole] = useState(null);

  const canManageRoles = checkIsOwner(currentUser);

  const fetchUsers = useCallback(async () => {
    try {
      const { data } = await usersAPI.getAll();
      setUsers(data.users);
    } catch (err) {
      toast.error('Failed to load users');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchPermissions = useCallback(async () => {
    try {
      const { data } = await rolesAPI.getPermissions();
      setRolePermissions(data.permissions);
      setOriginalPermissions(JSON.parse(JSON.stringify(data.permissions)));
    } catch (err) {
      toast.error('Failed to load permissions');
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchPermissions();
  }, [fetchUsers, fetchPermissions]);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setCreating(true);
    try {
      await usersAPI.create(createForm);
      toast.success('User created successfully');
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', role: 'staff' });
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create user');
    } finally {
      setCreating(false);
    }
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      await usersAPI.updateRole(userId, newRole);
      toast.success('Role updated');
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update role');
    }
  };

  const handleToggleActive = async (u) => {
    try {
      await usersAPI.updateStatus(u._id, !u.isActive);
      toast.success(u.isActive ? 'User deactivated' : 'User activated');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update status');
    }
  };

  const handleDeleteUser = async (u) => {
    if (!window.confirm(`Delete user "${u.name}"? This cannot be undone.`)) return;
    try {
      await usersAPI.delete(u._id);
      toast.success('User deleted');
      fetchUsers();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to delete user');
    }
  };

  // Permission editing
  const togglePermission = (role, permKey) => {
    if (role === 'owner' || !canManageRoles) return;
    setRolePermissions(prev => {
      const current = prev[role] || [];
      const updated = current.includes(permKey)
        ? current.filter(p => p !== permKey)
        : [...current, permKey];
      return { ...prev, [role]: updated };
    });
  };

  const hasUnsavedChanges = (role) => {
    const current = [...(rolePermissions[role] || [])].sort().join(',');
    const original = [...(originalPermissions[role] || [])].sort().join(',');
    return current !== original;
  };

  const handleSavePermissions = async (role) => {
    setSavingRole(role);
    try {
      await rolesAPI.updatePermissions(role, rolePermissions[role] || []);
      setOriginalPermissions(prev => ({
        ...prev,
        [role]: [...(rolePermissions[role] || [])],
      }));
      toast.success(`${role.charAt(0).toUpperCase() + role.slice(1)} permissions updated`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to save permissions');
    } finally {
      setSavingRole(null);
    }
  };

  const resetPermissions = (role) => {
    setRolePermissions(prev => ({
      ...prev,
      [role]: [...(originalPermissions[role] || [])],
    }));
  };

  const roleBadge = (role) => {
    const colors = { owner: 'badge-info', manager: 'badge-warning', staff: 'badge-gray' };
    return <span className={`badge ${colors[role] || 'badge-gray'}`}>{role?.toUpperCase()}</span>;
  };

  // Group permissions by group name
  const groupedPermissions = ALL_PERMISSIONS.reduce((acc, p) => {
    if (!acc[p.group]) acc[p.group] = [];
    acc[p.group].push(p);
    return acc;
  }, {});

  return (
    <div>
      <div className="page-header">
        <h2><Shield size={20} style={{ marginRight: 8 }} /> Roles & Permissions</h2>
      </div>

      {/* Roles Overview */}
      <div className="card" style={{ marginBottom: 24, padding: 0, overflow: 'visible' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Shield size={18} /> Role Definitions
          </h3>
        </div>
        <div>
          {ROLES.map((role, idx) => {
            const perms = rolePermissions[role.key] || [];
            const isExpanded = expandedRole === role.key;
            const dirty = hasUnsavedChanges(role.key);
            const isLast = idx === ROLES.length - 1;
            return (
              <div key={role.key} style={{ borderBottom: isLast && !isExpanded ? 'none' : '1px solid var(--border)' }}>
                <div
                  onClick={() => setExpandedRole(isExpanded ? null : role.key)}
                  style={{
                    padding: '14px 20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    transition: 'background 0.15s',
                  }}
                  className="hover-row"
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {roleBadge(role.key)}
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{role.label}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--gray-500)', marginTop: 2 }}>{role.description}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {dirty && <span className="badge badge-warning" style={{ fontSize: '0.7rem' }}>Unsaved</span>}
                    <span style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>{perms.length} permissions</span>
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </div>
                </div>
                {isExpanded && (
                  <div style={{ padding: '12px 20px 20px', background: 'var(--bg)' }}>
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                      gap: 12,
                    }}>
                      {Object.entries(groupedPermissions).map(([group, groupPerms]) => (
                        <div key={group} style={{
                          padding: 12,
                          borderRadius: 8,
                          border: '1px solid var(--border)',
                          background: 'var(--card-bg)',
                        }}>
                          <div style={{ fontWeight: 600, fontSize: '0.8rem', marginBottom: 8, color: 'var(--gray-600)' }}>
                            {group}
                          </div>
                          {groupPerms.map((p) => {
                            const has = perms.includes(p.key);
                            const canEdit = canManageRoles && role.key !== 'owner';
                            return (
                              <div
                                key={p.key}
                                onClick={() => canEdit && togglePermission(role.key, p.key)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  padding: '4px 6px',
                                  fontSize: '0.8rem',
                                  cursor: canEdit ? 'pointer' : 'default',
                                  borderRadius: 4,
                                  transition: 'background 0.1s',
                                }}
                                className={canEdit ? 'hover-row' : ''}
                              >
                                {has ? (
                                  <Check size={14} style={{ color: 'var(--success)', flexShrink: 0 }} />
                                ) : (
                                  <X size={14} style={{ color: 'var(--gray-400)', flexShrink: 0 }} />
                                )}
                                <span style={{ color: has ? 'var(--text)' : 'var(--gray-400)' }}>{p.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                    {canManageRoles && role.key !== 'owner' && dirty && (
                      <div style={{
                        display: 'flex',
                        gap: 8,
                        justifyContent: 'flex-end',
                        marginTop: 16,
                        paddingTop: 12,
                        borderTop: '1px solid var(--border)',
                      }}>
                        <button className="table-action-btn" onClick={() => resetPermissions(role.key)}
                          data-tooltip-id="roles-tooltip" data-tooltip-content="Reset">
                          <RotateCcw size={15} />
                        </button>
                        <button
                          className="btn btn-primary"
                          onClick={() => handleSavePermissions(role.key)}
                          disabled={savingRole === role.key}
                        >
                          <Save size={14} />
                          {savingRole === role.key ? 'Saving...' : 'Save Changes'}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* User Management */}
      <div className="card">
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={18} /> Team Members
          </h3>
          {canManageRoles && (
            <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
              <UserPlus size={14} /> Add User
            </button>
          )}
        </div>

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}>
            <div className="spinner" />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  {canManageRoles && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u._id} style={{ opacity: u.isActive ? 1 : 0.5 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="profile-avatar" style={{ width: 32, height: 32, fontSize: '0.8rem' }}>
                          {u.name?.charAt(0)?.toUpperCase()}
                        </div>
                        <span style={{ fontWeight: 500 }}>{u.name}</span>
                        {u._id === currentUser?.id && (
                          <span style={{ fontSize: '0.7rem', background: 'var(--primary)', color: '#fff', padding: '1px 6px', borderRadius: 4 }}>You</span>
                        )}
                      </div>
                    </td>
                    <td>{u.email}</td>
                    <td>
                      {editingUser === u._id && u.role !== 'owner' ? (
                        <select
                          className="form-control"
                          style={{ width: 120, padding: '4px 8px', fontSize: '0.8rem' }}
                          value={u.role}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          onBlur={() => setEditingUser(null)}
                          autoFocus
                        >
                          <option value="manager">Manager</option>
                          <option value="staff">Staff</option>
                        </select>
                      ) : (
                        <span style={{ cursor: canManageRoles && u.role !== 'owner' ? 'pointer' : 'default' }} onClick={() => canManageRoles && u.role !== 'owner' && setEditingUser(u._id)}>
                          {roleBadge(u.role)}
                          {canManageRoles && u.role !== 'owner' && <Pencil size={12} style={{ marginLeft: 6, color: 'var(--gray-400)' }} />}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${u.isActive ? 'badge-success' : 'badge-danger'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td style={{ fontSize: '0.8rem', color: 'var(--gray-500)' }}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    {canManageRoles && (
                      <td>
                        {u.role !== 'owner' && u._id !== currentUser?.id && (
                          <div style={{ display: 'flex', gap: 4 }}>
                            <button
                              className="table-action-btn view"
                              onClick={() => handleToggleActive(u)}
                              title={u.isActive ? 'Deactivate' : 'Activate'}
                            >
                              {u.isActive ? <ToggleRight size={14} /> : <ToggleLeft size={14} />}
                            </button>
                            <button
                              className="table-action-btn delete"
                              onClick={() => handleDeleteUser(u)}
                              title="Delete user"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3><UserPlus size={18} style={{ marginRight: 8 }} /> Add Team Member</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreateUser}>
                <div className="form-group">
                  <label>Full Name</label>
                  <input
                    className="form-control"
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Email</label>
                  <input
                    className="form-control"
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Password</label>
                  <input
                    className="form-control"
                    type="password"
                    value={createForm.password}
                    onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    required
                    minLength={6}
                  />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <select
                    className="form-control"
                    value={createForm.role}
                    onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                  >
                    <option value="manager">Manager</option>
                    <option value="staff">Staff</option>
                  </select>
                  <small style={{ color: 'var(--gray-500)', marginTop: 4, display: 'block', fontSize: '0.75rem' }}>
                    {createForm.role === 'manager'
                      ? 'Managers can create/edit products, orders, suppliers, and POs.'
                      : 'Staff can view data and create orders only.'}
                  </small>
                </div>
                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 16 }}>
                  <button type="button" className="btn btn-outline" onClick={() => setShowCreateModal(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary" disabled={creating}>
                    {creating ? 'Creating...' : 'Create User'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      <Tooltip id="roles-tooltip" place="top" />
    </div>
  );
};

export default RolesPermissions;
