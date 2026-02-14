import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { authAPI } from '../services/api';
import { User, Mail, Shield, Building2, Wifi, WifiOff, Lock, Save } from 'lucide-react';
import toast from 'react-hot-toast';

const Profile = () => {
  const { user, login } = useAuth();
  const { connected } = useSocket();

  const [profileForm, setProfileForm] = useState({
    name: user?.name || '',
    email: user?.email || '',
  });
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { data } = await authAPI.updateProfile({
        name: profileForm.name,
        email: profileForm.email,
      });
      localStorage.setItem('user', JSON.stringify(data.user));
      window.location.reload();
      toast.success('Profile updated successfully');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }
    setChangingPassword(true);
    try {
      await authAPI.changePassword({
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });
      toast.success('Password changed successfully');
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to change password');
    } finally {
      setChangingPassword(false);
    }
  };

  const roleBadge = (role) => {
    const map = {
      owner: 'badge-info',
      manager: 'badge-warning',
      staff: 'badge-gray',
    };
    return <span className={`badge ${map[role] || 'badge-gray'}`}>{role?.toUpperCase()}</span>;
  };

  return (
    <div>
      <div className="page-header">
        <h2>My Profile</h2>
      </div>

      {/* Profile Overview Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, padding: 8 }}>
          <div className="profile-avatar-lg">
            {user?.name?.charAt(0)?.toUpperCase() || 'U'}
          </div>
          <div style={{ flex: 1 }}>
            <h3 style={{ margin: 0, fontSize: '1.25rem' }}>{user?.name}</h3>
            <div style={{ color: 'var(--gray-600)', fontSize: '0.875rem', marginTop: 4 }}>{user?.email}</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 8 }}>
              {roleBadge(user?.role)}
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: 'var(--gray-600)' }}>
                <Building2 size={14} /> {user?.tenantName}
              </span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '0.8rem', color: connected ? 'var(--success)' : 'var(--gray-500)' }}>
                {connected ? <Wifi size={14} /> : <WifiOff size={14} />}
                {connected ? 'Online' : 'Offline'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile & Change Password side by side */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Edit Profile */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <User size={18} /> Edit Profile
            </h3>
          </div>
          <div style={{ padding: 20 }}>
            <form onSubmit={handleProfileUpdate}>
              <div className="form-group">
                <label>Full Name</label>
                <input
                  className="form-control"
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Email Address</label>
                <input
                  className="form-control"
                  type="email"
                  value={profileForm.email}
                  onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Role</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px', background: 'var(--gray-50)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--gray-200)' }}>
                  <Shield size={16} style={{ color: 'var(--gray-500)' }} />
                  <span style={{ color: 'var(--gray-600)', fontSize: '0.875rem' }}>
                    {user?.role?.charAt(0).toUpperCase() + user?.role?.slice(1)} — cannot be changed
                  </span>
                </div>
              </div>
              <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 8 }}>
                <Save size={16} style={{ marginRight: 6 }} />
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </form>
          </div>
        </div>

        {/* Change Password */}
        <div className="card">
          <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--gray-200)' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lock size={18} /> Change Password
            </h3>
          </div>
          <div style={{ padding: 20 }}>
            <form onSubmit={handlePasswordChange}>
              <div className="form-group">
                <label>Current Password</label>
                <input
                  className="form-control"
                  type="password"
                  value={passwordForm.currentPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>New Password</label>
                <input
                  className="form-control"
                  type="password"
                  value={passwordForm.newPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  className="form-control"
                  type="password"
                  value={passwordForm.confirmPassword}
                  onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                  required
                  minLength={6}
                />
              </div>
              <button type="submit" className="btn btn-primary" disabled={changingPassword} style={{ marginTop: 8 }}>
                <Lock size={16} style={{ marginRight: 6 }} />
                {changingPassword ? 'Changing...' : 'Change Password'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
