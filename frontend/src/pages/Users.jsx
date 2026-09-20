import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { authService } from '../services/api';

const roleLabels = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  developer: 'Developer',
  tester: 'QA / Tester'
};

const roleColors = {
  admin: 'role-admin',
  project_manager: 'role-project_manager',
  developer: 'role-developer',
  tester: 'role-tester'
};

const Users = () => {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [selectedRoles, setSelectedRoles] = useState({});
  const [updatingId, setUpdatingId] = useState(null);
  const [feedback, setFeedback] = useState({ type: '', message: '' });

  const isAdmin = currentUser?.role === 'admin';

  const fetchUsers = async () => {
    if (!isAdmin) {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setFeedback({ type: '', message: '' });
      const res = await authService.getUsers();
      if (res.success && res.users) {
        setUsers(res.users);
        const rolesMap = {};
        res.users.forEach((u) => {
          rolesMap[u.id || u._id] = u.role;
        });
        setSelectedRoles(rolesMap);
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to load user directory.'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [isAdmin]);

  const handleRoleSelect = (userId, newRole) => {
    setSelectedRoles((prev) => ({
      ...prev,
      [userId]: newRole
    }));
  };

  const handleSaveRole = async (userId, userName) => {
    const targetRole = selectedRoles[userId];
    if (!targetRole) return;

    try {
      setUpdatingId(userId);
      setFeedback({ type: '', message: '' });

      const res = await authService.updateUserRole(userId, targetRole);
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) =>
            (u.id || u._id) === userId ? { ...u, role: targetRole } : u
          )
        );
        setFeedback({
          type: 'success',
          message: `Role for ${userName} updated to ${roleLabels[targetRole] || targetRole}.`
        });
      }
    } catch (err) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to update user role.'
      });
    } finally {
      setUpdatingId(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <main className="main-content">
          <div className="card" style={{ maxWidth: '600px', margin: '4rem auto', textAlign: 'center', padding: '2.5rem' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: '1rem' }}>🔒</span>
            <h2 style={{ margin: '0 0 0.5rem 0' }}>Access Restricted</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Only system administrators have permission to manage team member roles.
            </p>
            <Link to="/dashboard" className="btn-action-primary">
              Return to Dashboard
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      (u.name && u.name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (u.email && u.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  const stats = {
    total: users.length,
    admin: users.filter((u) => u.role === 'admin').length,
    project_manager: users.filter((u) => u.role === 'project_manager').length,
    developer: users.filter((u) => u.role === 'developer').length,
    tester: users.filter((u) => u.role === 'tester').length
  };

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="main-content" id="users-page">
        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>
              Team & Role Management
            </h1>
            <p className="page-subtitle" style={{ margin: 0, color: 'var(--text-muted)' }}>
              Manage access and configure permissions across system roles.
            </p>
          </div>
        </div>

        {/* Feedback Alert */}
        {feedback.message && (
          <div
            className={feedback.type === 'success' ? 'alert alert-success' : 'alert-error'}
            role="alert"
            style={{ marginBottom: '1.5rem' }}
          >
            <span className="alert-icon">{feedback.type === 'success' ? '✅' : '⚠️'}</span>
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Summary Stat Cards */}
        <div className="stats-grid stats-grid-5" style={{ marginBottom: '1.5rem' }}>
          <div className="stat-card">
            <div className="stat-icon-wrapper blue">👥</div>
            <div className="stat-content">
              <span className="stat-label">Total Users</span>
              <span className="stat-value">{isLoading ? '...' : stats.total}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper purple">👑</div>
            <div className="stat-content">
              <span className="stat-label">Admins</span>
              <span className="stat-value">{isLoading ? '...' : stats.admin}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper indigo">💼</div>
            <div className="stat-content">
              <span className="stat-label">Managers</span>
              <span className="stat-value">{isLoading ? '...' : stats.project_manager}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper teal">💻</div>
            <div className="stat-content">
              <span className="stat-label">Developers</span>
              <span className="stat-value">{isLoading ? '...' : stats.developer}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon-wrapper green">🧪</div>
            <div className="stat-content">
              <span className="stat-label">Testers</span>
              <span className="stat-value">{isLoading ? '...' : stats.tester}</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Card */}
        <div className="card" style={{ padding: '1rem 1.25rem', marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 250px' }}>
              <input
                type="text"
                className="form-input"
                placeholder="Search user by name or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: '100%', padding: '0.5rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Role:</span>
              <select
                className="form-select"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                style={{ padding: '0.45rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              >
                <option value="all">All Roles</option>
                <option value="admin">Administrator</option>
                <option value="project_manager">Project Manager</option>
                <option value="developer">Developer</option>
                <option value="tester">QA / Tester</option>
              </select>
            </div>
          </div>
        </div>

        {/* Users Table Card */}
        <div className="card">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0 }}>Team Directory ({filteredUsers.length})</h3>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {isLoading ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ marginBottom: '0.5rem' }}></div>
                Loading users...
              </div>
            ) : filteredUsers.length === 0 ? (
              <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                No users found matching your search.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table" id="users-table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Email</th>
                      <th>Auth Provider</th>
                      <th>Current Role</th>
                      <th>Change Role</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const uId = u.id || u._id;
                      const currentSelectedRole = selectedRoles[uId] || u.role;
                      const hasChanged = currentSelectedRole !== u.role;
                      const isSelf = uId === (currentUser.id || currentUser._id);

                      return (
                        <tr key={uId} className="user-row" id={`user-row-${uId}`}>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  background: 'var(--primary, #3b82f6)',
                                  color: '#fff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontWeight: '600',
                                  fontSize: '0.85rem'
                                }}
                              >
                                {u.name ? u.name.charAt(0).toUpperCase() : 'U'}
                              </div>
                              <div>
                                <strong style={{ color: 'var(--text-main)' }}>{u.name}</strong>
                                {isSelf && (
                                  <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: 'var(--primary)', fontWeight: '600' }}>
                                    (You)
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td style={{ color: 'var(--text-muted)' }}>{u.email}</td>
                          <td>
                            <span
                              style={{
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                background: u.authProvider === 'google' ? '#fee2e2' : '#f1f5f9',
                                color: u.authProvider === 'google' ? '#b91c1c' : '#475569',
                                fontWeight: '600'
                              }}
                            >
                              {u.authProvider === 'google' ? 'Google' : 'Local'}
                            </span>
                          </td>
                          <td>
                            <span className={`role-badge ${roleColors[u.role] || 'role-developer'}`}>
                              {roleLabels[u.role] || u.role}
                            </span>
                          </td>
                          <td>
                            <select
                              id={`role-select-${uId}`}
                              className="form-select"
                              value={currentSelectedRole}
                              onChange={(e) => handleRoleSelect(uId, e.target.value)}
                              disabled={updatingId === uId}
                              style={{
                                padding: '0.35rem 0.6rem',
                                borderRadius: '4px',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.85rem',
                                minWidth: '150px'
                              }}
                            >
                              <option value="admin">Administrator</option>
                              <option value="project_manager">Project Manager</option>
                              <option value="developer">Developer</option>
                              <option value="tester">QA / Tester</option>
                            </select>
                          </td>
                          <td>
                            <button
                              id={`btn-save-role-${uId}`}
                              type="button"
                              className="btn-action-primary-small"
                              disabled={!hasChanged || updatingId === uId}
                              onClick={() => handleSaveRole(uId, u.name)}
                              style={{
                                opacity: hasChanged ? 1 : 0.4,
                                cursor: hasChanged ? 'pointer' : 'not-allowed',
                                fontSize: '0.8rem',
                                padding: '0.35rem 0.75rem'
                              }}
                            >
                              {updatingId === uId ? 'Saving...' : 'Apply Role'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Users;
