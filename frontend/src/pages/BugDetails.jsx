import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { bugService, projectService } from '../services/api';

const severityLabels = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const priorityLabels = {
  urgent: 'Urgent',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const statusLabels = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened'
};

const roleLabels = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  developer: 'Developer',
  tester: 'QA / Tester'
};

const BugDetails = () => {
  const { projectId, bugId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [bug, setBug] = useState(null);
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Status & Resolution update state
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState('open');
  const [resolutionText, setResolutionText] = useState('');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const [statusError, setStatusError] = useState('');

  // Assign user state
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedAssignee, setSelectedAssignee] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');

  // Edit bug details state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    severity: 'medium',
    priority: 'medium'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete bug state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchBugDetails = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const [bugRes, projRes] = await Promise.all([
        bugService.getBugById(projectId, bugId),
        projectService.getProjectById(projectId)
      ]);

      if (bugRes.success && bugRes.bug) {
        setBug(bugRes.bug);
        setNewStatus(bugRes.bug.status);
        setResolutionText(bugRes.bug.resolution || '');
        setSelectedAssignee(bugRes.bug.assignedTo?._id || '');
        setEditFormData({
          title: bugRes.bug.title,
          description: bugRes.bug.description,
          severity: bugRes.bug.severity,
          priority: bugRes.bug.priority
        });
      }

      if (projRes.success && projRes.project) {
        setProject(projRes.project);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load bug report details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBugDetails();
  }, [projectId, bugId]);

  const isOwner = project && user && project.owner?._id === user.id;
  const isAdmin = user && user.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;
  const isAssignedDev = bug && user && bug.assignedTo?._id === user.id;
  const isReporter = bug && user && bug.reportedBy?._id === user.id;

  const canManageAssignment = isOwnerOrAdmin;
  const canUpdateStatus = isOwnerOrAdmin || isAssignedDev;
  const canEditBug = isOwnerOrAdmin || isReporter;
  const canDeleteBug = isOwnerOrAdmin;

  // Candidates for assignment: Project owner + Project members
  const assignableUsers = [];
  if (project?.owner) {
    assignableUsers.push(project.owner);
  }
  if (project?.members) {
    project.members.forEach((m) => {
      if (!assignableUsers.some((u) => u._id === m._id)) {
        assignableUsers.push(m);
      }
    });
  }

  const handleStatusSubmit = async (e) => {
    e.preventDefault();
    setStatusError('');

    try {
      setIsUpdatingStatus(true);
      const response = await bugService.updateBug(projectId, bugId, {
        status: newStatus,
        resolution: resolutionText
      });

      if (response.success && response.bug) {
        setBug(response.bug);
        setShowStatusModal(false);
        setSuccessMessage(`Bug status updated to '${statusLabels[response.bug.status] || response.bug.status}' successfully.`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setStatusError(error.message || 'Failed to update bug status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setAssignError('');

    try {
      setIsAssigning(true);
      const response = await bugService.assignBug(projectId, bugId, selectedAssignee || null);

      if (response.success && response.bug) {
        setBug(response.bug);
        setShowAssignModal(false);
        const name = response.bug.assignedTo ? response.bug.assignedTo.name : 'Unassigned';
        setSuccessMessage(`Bug assignment set to: ${name}`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setAssignError(error.message || 'Failed to update bug assignment');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');

    try {
      setIsEditing(true);
      const response = await bugService.updateBug(projectId, bugId, editFormData);

      if (response.success && response.bug) {
        setBug(response.bug);
        setShowEditModal(false);
        setSuccessMessage('Bug report details updated successfully.');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setEditError(error.message || 'Failed to update bug report');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteBug = async () => {
    try {
      setIsDeleting(true);
      const response = await bugService.deleteBug(projectId, bugId);
      if (response.success) {
        navigate(`/projects/${projectId}`, { replace: true });
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to delete bug report');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <div className="page-loading-state">
          <div className="spinner"></div>
          <p>Loading bug report details...</p>
        </div>
      </div>
    );
  }

  if (!bug) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <main className="main-content">
          <div className="empty-state-card">
            <h3>Bug Report Not Found</h3>
            <p>The requested bug report could not be found or has been deleted.</p>
            <Link to={`/projects/${projectId}`} className="btn-action-primary">
              &larr; Back to Project
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="main-content">
        {/* Breadcrumb Navigation */}
        <nav className="breadcrumb-nav">
          <Link to="/projects" className="breadcrumb-link">Projects</Link>
          <span className="breadcrumb-sep">&gt;</span>
          <Link to={`/projects/${projectId}`} className="breadcrumb-link">
            {project?.name || 'Project'} ({project?.key || '...'})
          </Link>
          <span className="breadcrumb-sep">&gt;</span>
          <span className="breadcrumb-current">Bug #{bug._id.slice(-6).toUpperCase()}</span>
        </nav>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {successMessage && (
          <div className="alert-success" role="alert">
            <span className="alert-icon">✓</span>
            <span>{successMessage}</span>
          </div>
        )}

        {/* Bug Header Card */}
        <div className="project-detail-header card">
          <div className="header-info">
            <div className="key-and-status">
              <span className="badge-tag bug-tag">BUG-{bug._id.slice(-6).toUpperCase()}</span>
              <span className={`status-pill status-${bug.status}`}>
                {statusLabels[bug.status] || bug.status}
              </span>
              <span className={`severity-badge severity-${bug.severity}`}>
                Severity: {severityLabels[bug.severity] || bug.severity}
              </span>
              <span className={`priority-badge priority-${bug.priority}`}>
                Priority: {priorityLabels[bug.priority] || bug.priority}
              </span>
            </div>
            <h1 className="project-detail-title">{bug.title}</h1>
            <p className="detail-subtitle">
              Reported by <strong>{bug.reportedBy?.name || 'Unknown'}</strong> on {new Date(bug.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="header-actions">
            {canUpdateStatus && (
              <button
                onClick={() => {
                  setNewStatus(bug.status);
                  setResolutionText(bug.resolution || '');
                  setStatusError('');
                  setShowStatusModal(true);
                }}
                className="btn-action-primary"
                id="btn-open-status-modal"
              >
                ⚡ Update Status & Resolution
              </button>
            )}

            {canManageAssignment && (
              <button
                onClick={() => {
                  setSelectedAssignee(bug.assignedTo?._id || '');
                  setAssignError('');
                  setShowAssignModal(true);
                }}
                className="btn-secondary"
                id="btn-open-assign-modal"
              >
                👤 Assign Developer
              </button>
            )}

            {canEditBug && (
              <button
                onClick={() => {
                  setEditFormData({
                    title: bug.title,
                    description: bug.description,
                    severity: bug.severity,
                    priority: bug.priority
                  });
                  setEditError('');
                  setShowEditModal(true);
                }}
                className="btn-secondary"
                id="btn-open-edit-bug"
              >
                ✏️ Edit Details
              </button>
            )}

            {canDeleteBug && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn-danger-outline"
                id="btn-open-delete-bug"
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </div>

        {/* Bug Metadata & Description Grid */}
        <div className="details-grid">
          {/* Main Bug Details Card */}
          <div className="card info-card">
            <div className="card-header">
              <h3>Defect Description & Steps</h3>
            </div>
            <div className="card-body">
              <div className="bug-description-content">
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{bug.description}</p>
              </div>

              <div className="resolution-section" style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '1rem', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                  Resolution Summary
                </h4>
                {bug.resolution ? (
                  <div className="resolution-box" style={{ background: '#f0fdf4', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #bbf7d0', color: '#166534' }}>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{bug.resolution}</p>
                  </div>
                ) : (
                  <p className="empty-text" style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                    No resolution notes recorded yet. Assigned developer or project manager can provide resolution notes when resolving this defect.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bug Assignment & Status Card */}
          <div className="card members-card">
            <div className="card-header">
              <h3>Triage & Attribution</h3>
            </div>
            <div className="card-body">
              <div className="meta-list">
                <div className="meta-row">
                  <span className="meta-label">Current Status</span>
                  <span className="meta-value">
                    <span className={`status-pill status-${bug.status}`}>
                      {statusLabels[bug.status] || bug.status}
                    </span>
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Severity</span>
                  <span className="meta-value">
                    <span className={`severity-badge severity-${bug.severity}`}>
                      {severityLabels[bug.severity] || bug.severity}
                    </span>
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Priority</span>
                  <span className="meta-value">
                    <span className={`priority-badge priority-${bug.priority}`}>
                      {priorityLabels[bug.priority] || bug.priority}
                    </span>
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Assigned Developer</span>
                  <span className="meta-value" id="bug-assigned-user">
                    {bug.assignedTo ? (
                      <span>
                        <strong>{bug.assignedTo.name}</strong> ({bug.assignedTo.email}) &mdash;{' '}
                        <span className={`role-badge role-${bug.assignedTo.role}`}>
                          {roleLabels[bug.assignedTo.role] || bug.assignedTo.role}
                        </span>
                      </span>
                    ) : (
                      <span className="badge-unassigned" style={{ color: '#d97706', fontWeight: 600 }}>
                        ⚠️ Unassigned
                      </span>
                    )}
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Reported By</span>
                  <span className="meta-value">
                    <strong>{bug.reportedBy?.name}</strong> ({bug.reportedBy?.email}) &mdash;{' '}
                    <span className={`role-badge role-${bug.reportedBy?.role}`}>
                      {roleLabels[bug.reportedBy?.role] || bug.reportedBy?.role}
                    </span>
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Date Reported</span>
                  <span className="meta-value">{new Date(bug.createdAt).toLocaleString()}</span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Last Updated</span>
                  <span className="meta-value">{new Date(bug.updatedAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Configuration Management Traceability Section */}
        <div className="card traceability-card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Configuration Management Traceability</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Baseline linkages between this defect report, software version releases, and Unity Version Control.
              </p>
            </div>
            <span className="badge-upcoming">SCM Traceability</span>
          </div>
          <div className="card-body">
            <div className="traceability-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
              <div className="trace-item" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Project Scope
                </span>
                <strong style={{ fontSize: '1rem', color: '#1e293b' }}>{project?.name}</strong>
                <span className="project-key-tag" style={{ marginLeft: '0.5rem', fontSize: '0.75rem' }}>{project?.key}</span>
              </div>

              <div className="trace-item" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Related Software Version
                </span>
                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 500 }}>
                  Not linked yet
                </span>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Version release mapping will be linked in upcoming SCM releases module.
                </p>
              </div>

              <div className="trace-item" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Unity Version Control Changeset
                </span>
                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 500 }}>
                  Not linked yet
                </span>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Unity Version Control check-ins and branches are tracked separately.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Status & Resolution Modal */}
        {showStatusModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Update Bug Status & Resolution</h3>
                <button
                  onClick={() => setShowStatusModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {statusError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{statusError}</span>
                </div>
              )}

              <form onSubmit={handleStatusSubmit} className="modal-form">
                <div className="form-group">
                  <label htmlFor="select-bug-status">Lifecycle Status *</label>
                  <select
                    id="select-bug-status"
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value)}
                    disabled={isUpdatingStatus}
                    required
                  >
                    <option value="open">Open (Reported)</option>
                    <option value="in_progress">In Progress (Active Work)</option>
                    <option value="resolved">Resolved (Fix Applied)</option>
                    <option value="closed">Closed (Verified & Done)</option>
                    <option value="reopened">Reopened (Regression)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="input-bug-resolution">Resolution Summary / Fix Notes</label>
                  <textarea
                    id="input-bug-resolution"
                    rows="3"
                    placeholder="Describe how this defect was fixed, verified, or reason for closing..."
                    value={resolutionText}
                    onChange={(e) => setResolutionText(e.target.value)}
                    disabled={isUpdatingStatus}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowStatusModal(false)}
                    className="btn-secondary"
                    disabled={isUpdatingStatus}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-save-status-update"
                    disabled={isUpdatingStatus}
                  >
                    {isUpdatingStatus ? 'Updating...' : 'Save Status Update'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Assign Developer Modal */}
        {showAssignModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Assign Developer to Bug</h3>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {assignError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{assignError}</span>
                </div>
              )}

              <form onSubmit={handleAssignSubmit} className="modal-form">
                <div className="form-group">
                  <label htmlFor="select-assign-user">Assigned Team Member</label>
                  <select
                    id="select-assign-user"
                    value={selectedAssignee}
                    onChange={(e) => setSelectedAssignee(e.target.value)}
                    disabled={isAssigning}
                  >
                    <option value="">-- Unassigned (No Developer) --</option>
                    {assignableUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.email}) - {roleLabels[u.role] || u.role}
                      </option>
                    ))}
                  </select>
                  <span className="form-hint">Only project members and the project lead can be assigned to bugs.</span>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowAssignModal(false)}
                    className="btn-secondary"
                    disabled={isAssigning}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-save-assign"
                    disabled={isAssigning}
                  >
                    {isAssigning ? 'Assigning...' : 'Save Assignment'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Bug Modal */}
        {showEditModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Edit Bug Report Details</h3>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {editError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{editError}</span>
                </div>
              )}

              <form onSubmit={handleEditSubmit} className="modal-form">
                <div className="form-group">
                  <label htmlFor="edit-bug-title">Bug Title *</label>
                  <input
                    id="edit-bug-title"
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    disabled={isEditing}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="edit-bug-severity">Severity</label>
                    <select
                      id="edit-bug-severity"
                      value={editFormData.severity}
                      onChange={(e) => setEditFormData({ ...editFormData, severity: e.target.value })}
                      disabled={isEditing}
                    >
                      <option value="critical">Critical</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-bug-priority">Priority</label>
                    <select
                      id="edit-bug-priority"
                      value={editFormData.priority}
                      onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                      disabled={isEditing}
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-bug-desc">Description & Steps *</label>
                  <textarea
                    id="edit-bug-desc"
                    rows="4"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    disabled={isEditing}
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn-secondary"
                    disabled={isEditing}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-save-edit-bug"
                    disabled={isEditing}
                  >
                    {isEditing ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Confirm Bug Deletion</h3>
                <button
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              <div className="modal-body-confirm">
                <p>
                  Are you sure you want to delete this bug report: <strong>{bug.title}</strong>?
                </p>
                <p className="warning-text">
                  This action will permanently remove this defect tracking record from MongoDB.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary"
                  disabled={isDeleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBug}
                  className="btn-danger"
                  id="btn-confirm-delete-bug"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Bug'}
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default BugDetails;
