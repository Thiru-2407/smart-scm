import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const roleLabels = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  developer: 'Developer',
  tester: 'QA / Tester'
};

const Navbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="navbar">
      <div className="nav-container">
        <div className="nav-brand-group">
          <NavLink to="/dashboard" className="nav-brand-link">
            <div className="brand-logo-badge">SCM</div>
            <div className="brand-text">
              <span className="brand-title">Smart SCM</span>
              <span className="brand-subtitle">Release & Version Tracking</span>
            </div>
          </NavLink>

          <nav className="nav-menu">
            <NavLink
              to="/dashboard"
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              Dashboard
            </NavLink>
            <NavLink
              to="/projects"
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              Projects
            </NavLink>
            <NavLink
              to="/reports"
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              id="nav-link-reports"
            >
              Reports
            </NavLink>
            <NavLink
              to="/activity"
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              id="nav-link-activity"
            >
              Activity
            </NavLink>
            <NavLink
              to="/traceability"
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              id="nav-link-traceability"
            >
              Traceability
            </NavLink>
            <NavLink
              to="/uvcs"
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
              id="nav-link-uvcs"
            >
              Version Control
            </NavLink>
          </nav>
        </div>

        <div className="nav-user-actions">
          <div className="nav-user-info">
            <span className="user-name">{user?.name || 'User'}</span>
            <span className={`role-badge role-${user?.role || 'developer'}`}>
              {roleLabels[user?.role] || user?.role}
            </span>
          </div>
          <button
            onClick={handleLogout}
            className="btn-logout"
            title="Sign out of Smart SCM"
          >
            Sign Out
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
