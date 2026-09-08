import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { auditService, projectService } from '../services/api';

const roleLabels = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  developer: 'Developer',
  tester: 'QA / Tester'
};

const getActionInfo = (action, entityType) => {
  switch (action) {
    case 'PROJECT_CREATED':
      return { icon: '📁', label: 'Project Created', color: 'blue' };
    case 'PROJECT_UPDATED':
      return { icon: '📁', label: 'Project Updated', color: 'blue' };
    case 'VERSION_CREATED':
      return { icon: '🏷️', label: 'Version Created', color: 'purple' };
    case 'VERSION_UPDATED':
      return { icon: '🏷️', label: 'Version Updated', color: 'purple' };
    case 'BUG_CREATED':
      return { icon: '🐛', label: 'Defect Reported', color: 'red' };
    case 'BUG_UPDATED':
      return { icon: '🔧', label: 'Defect Updated', color: 'amber' };
    case 'CHANGE_REQUEST_CREATED':
      return { icon: '📝', label: 'Change Requested', color: 'orange' };
    case 'CHANGE_REQUEST_STATUS_CHANGED':
      return { icon: '📋', label: 'CR Status Changed', color: 'indigo' };
    case 'RELEASE_CREATED':
      return { icon: '📦', label: 'Release Drafted', color: 'teal' };
    case 'RELEASE_APPROVED':
      return { icon: '👍', label: 'Release Approved', color: 'teal' };
    case 'RELEASE_PUBLISHED':
      return { icon: '🚀', label: 'Release Published', color: 'green' };
    case 'UVCS_BASELINE_LINKED':
      return { icon: '🔄', label: 'UVCS Baseline Linked', color: 'cyan' };
    default:
      return { icon: '📌', label: action.replace(/_/g, ' '), color: 'gray' };
  }
};

const getDateHeading = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  if (isToday) return 'Today';
  if (isYesterday) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
};

const formatTime = (dateStr) => {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

const getRelativeTime = (dateStr) => {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};

const Activity = () => {
  const { user } = useAuth();

  const [auditLogs, setAuditLogs] = useState([]);
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // Filter states
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedEntityType, setSelectedEntityType] = useState('');
  const [selectedAction, setSelectedAction] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Expanded metadata items
  const [expandedItems, setExpandedItems] = useState(new Set());

  const toggleExpand = (id) => {
    setExpandedItems(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Load accessible projects for filter dropdown
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getProjects();
        if (res.success && res.projects) {
          setProjects(res.projects);
        }
      } catch (err) {
        console.error('Error loading projects list:', err);
      }
    };
    fetchProjects();
  }, []);

  // Fetch audit logs
  const loadLogs = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      const params = {
        page,
        limit: 20
      };
      if (selectedProject) params.project = selectedProject;
      if (selectedEntityType) params.entityType = selectedEntityType;
      if (selectedAction) params.action = selectedAction;

      const res = await auditService.getAuditLogs(params);
      if (res.success) {
        setAuditLogs(res.auditLogs || []);
        setTotalPages(res.pages || 1);
        setTotalCount(res.total || 0);
      }
    } catch (err) {
      setError(err.message || 'Failed to load audit activity logs');
    } finally {
      setIsLoading(false);
    }
  }, [page, selectedProject, selectedEntityType, selectedAction]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleResetFilters = () => {
    setSelectedProject('');
    setSelectedEntityType('');
    setSelectedAction('');
    setPage(1);
  };

  // Group activities by date
  const groupedActivities = auditLogs.reduce((groups, log) => {
    const heading = getDateHeading(log.createdAt);
    if (!groups[heading]) {
      groups[heading] = [];
    }
    groups[heading].push(log);
    return groups;
  }, {});

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content">
        {/* Page Header */}
        <div className="page-header-row" style={{ marginBottom: '1.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.25rem' }}>
              <h1 style={{ fontSize: '1.75rem', fontWeight: 700, margin: 0 }}>Audit &amp; Activity Log</h1>
              <span className="badge-active" style={{ background: '#eff6ff', color: 'var(--primary)', borderColor: '#bfdbfe' }}>
                Phase 13 - Live
              </span>
            </div>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
              Chronological immutable record of configuration management events, approvals, and traceability baselines.
            </p>
          </div>
          <button
            onClick={loadLogs}
            className="btn btn-secondary"
            disabled={isLoading}
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', alignSelf: 'flex-start' }}
          >
            <span>🔄</span> Refresh
          </button>
        </div>

        {/* Filters Toolbar Card */}
        <div className="card" style={{ marginBottom: '1.75rem', padding: '1.25rem 1.5rem' }}>
          <div className="activity-filters-grid">
            <div className="filter-group">
              <label htmlFor="filter-project" className="form-label" style={{ fontSize: '0.82rem' }}>Project</label>
              <select
                id="filter-project"
                className="form-input"
                value={selectedProject}
                onChange={(e) => { setSelectedProject(e.target.value); setPage(1); }}
              >
                <option value="">All Accessible Projects</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="filter-entity" className="form-label" style={{ fontSize: '0.82rem' }}>Entity Type</label>
              <select
                id="filter-entity"
                className="form-input"
                value={selectedEntityType}
                onChange={(e) => { setSelectedEntityType(e.target.value); setPage(1); }}
              >
                <option value="">All Entities</option>
                <option value="Project">Project</option>
                <option value="Version">Version</option>
                <option value="Bug">Bug / Defect</option>
                <option value="ChangeRequest">Change Request</option>
                <option value="Release">Release</option>
                <option value="UVCS">Unity Version Control</option>
              </select>
            </div>

            <div className="filter-group">
              <label htmlFor="filter-action" className="form-label" style={{ fontSize: '0.82rem' }}>Action Type</label>
              <select
                id="filter-action"
                className="form-input"
                value={selectedAction}
                onChange={(e) => { setSelectedAction(e.target.value); setPage(1); }}
              >
                <option value="">All Actions</option>
                <option value="PROJECT_CREATED">PROJECT_CREATED</option>
                <option value="PROJECT_UPDATED">PROJECT_UPDATED</option>
                <option value="VERSION_CREATED">VERSION_CREATED</option>
                <option value="VERSION_UPDATED">VERSION_UPDATED</option>
                <option value="BUG_CREATED">BUG_CREATED</option>
                <option value="BUG_UPDATED">BUG_UPDATED</option>
                <option value="CHANGE_REQUEST_CREATED">CHANGE_REQUEST_CREATED</option>
                <option value="CHANGE_REQUEST_STATUS_CHANGED">CHANGE_REQUEST_STATUS_CHANGED</option>
                <option value="RELEASE_CREATED">RELEASE_CREATED</option>
                <option value="RELEASE_APPROVED">RELEASE_APPROVED</option>
                <option value="RELEASE_PUBLISHED">RELEASE_PUBLISHED</option>
                <option value="UVCS_BASELINE_LINKED">UVCS_BASELINE_LINKED</option>
              </select>
            </div>

            <div className="filter-actions-col">
              {(selectedProject || selectedEntityType || selectedAction) && (
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="btn btn-outline"
                  style={{ width: '100%' }}
                >
                  Clear Filters
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            <span>⚠️</span>
            <div style={{ flex: 1 }}>{error}</div>
            <button onClick={loadLogs} className="btn-link" style={{ color: 'var(--danger)' }}>Retry</button>
          </div>
        )}

        {/* Results Summary Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
          <span>
            {isLoading ? 'Loading activities...' : `Showing ${auditLogs.length} of ${totalCount} recorded events`}
          </span>
          {totalPages > 1 && (
            <span>Page {page} of {totalPages}</span>
          )}
        </div>

        {/* Activity Timeline */}
        {isLoading && auditLogs.length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>⏳</div>
            <p>Loading chronological activity stream...</p>
          </div>
        ) : Object.keys(groupedActivities).length === 0 ? (
          <div className="card" style={{ padding: '3rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>📋</div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>No Audit Records Found</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '400px', margin: '0 auto 1.25rem' }}>
              {selectedProject || selectedEntityType || selectedAction
                ? 'No activities match the selected filter criteria. Try clearing or adjusting filters.'
                : 'No activities have been recorded yet in this workspace.'}
            </p>
            {(selectedProject || selectedEntityType || selectedAction) && (
              <button onClick={handleResetFilters} className="btn btn-secondary">
                Reset Filters
              </button>
            )}
          </div>
        ) : (
          <div className="activity-timeline">
            {Object.entries(groupedActivities).map(([heading, logs]) => (
              <div key={heading} className="timeline-date-group">
                <div className="timeline-date-header">
                  <span className="timeline-date-pill">{heading}</span>
                </div>

                <div className="timeline-items">
                  {logs.map((log) => {
                    const actionInfo = getActionInfo(log.action, log.entityType);
                    const isExpanded = expandedItems.has(log._id);
                    const hasMetadata = log.metadata && Object.keys(log.metadata).length > 0;

                    return (
                      <div key={log._id} className="timeline-entry" id={`activity-entry-${log._id}`}>
                        <div className={`timeline-marker marker-${actionInfo.color}`}>
                          <span>{actionInfo.icon}</span>
                        </div>

                        <div className="timeline-card card">
                          <div className="timeline-card-header">
                            <div className="timeline-badges">
                              <span className={`activity-action-badge badge-${actionInfo.color}`}>
                                {actionInfo.label}
                              </span>
                              {log.project && (
                                <Link
                                  to={`/projects/${log.project._id}`}
                                  className="project-key-tag"
                                  title={log.project.name}
                                >
                                  {log.project.key}
                                </Link>
                              )}
                              <span className="entity-type-badge">{log.entityType}</span>
                            </div>
                            <div className="timeline-timestamps">
                              <span className="relative-time" title={new Date(log.createdAt).toLocaleString()}>
                                {getRelativeTime(log.createdAt)}
                              </span>
                              <span className="time-divider">•</span>
                              <span className="clock-time">{formatTime(log.createdAt)}</span>
                            </div>
                          </div>

                          <div className="timeline-card-body">
                            <p className="activity-description">{log.description}</p>

                            <div className="activity-footer">
                              <div className="activity-actor">
                                <span className="actor-avatar">
                                  {log.actor?.name ? log.actor.name.charAt(0).toUpperCase() : 'U'}
                                </span>
                                <span className="actor-name">{log.actor?.name || 'System User'}</span>
                                <span className={`role-badge role-${log.actor?.role || 'developer'}`}>
                                  {roleLabels[log.actor?.role] || log.actor?.role}
                                </span>
                              </div>

                              {hasMetadata && (
                                <button
                                  type="button"
                                  onClick={() => toggleExpand(log._id)}
                                  className="btn-metadata-toggle"
                                  aria-expanded={isExpanded}
                                >
                                  {isExpanded ? 'Hide Details ▲' : 'Show Details ▼'}
                                </button>
                              )}
                            </div>

                            {hasMetadata && isExpanded && (
                              <div className="activity-metadata-container">
                                <div className="metadata-title">Event Metadata</div>
                                <div className="metadata-grid">
                                  {Object.entries(log.metadata).map(([metaKey, metaVal]) => (
                                    <div key={metaKey} className="metadata-row">
                                      <span className="meta-key">{metaKey}:</span>
                                      <span className="meta-val">
                                        {typeof metaVal === 'object' && metaVal !== null
                                          ? JSON.stringify(metaVal)
                                          : String(metaVal)}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="pagination-bar" style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page <= 1 || isLoading}
              className="btn btn-secondary"
            >
              ← Previous
            </button>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages || isLoading}
              className="btn btn-secondary"
            >
              Next →
            </button>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Activity;
