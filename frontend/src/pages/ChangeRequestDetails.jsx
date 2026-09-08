import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { changeRequestService, projectService } from '../services/api';

const priorityLabels = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const statusLabels = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  implemented: 'Implemented',
  cancelled: 'Cancelled'
};

const roleLabels = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  developer: 'Developer',
  tester: 'QA / Tester'
};

const ChangeRequestDetails = () => {
  const { projectId, changeRequestId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [changeRequest, setChangeRequest] = useState(null);
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Review / Status transition state
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState('under_review');
  const [implementationNotes, setImplementationNotes] = useState('');
  const [isReviewing, setIsReviewing] = useState(false);
  const [reviewError, setReviewError] = useState('');

  // Edit CR details state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    title: '',
    description: '',
    reason: '',
    priority: 'medium'
  });
  const [isEditing, setIsEditing] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete CR state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchChangeRequestDetails = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const [crRes, projRes] = await Promise.all([
        changeRequestService.getChangeRequestById(projectId, changeRequestId),
        projectService.getProjectById(projectId)
      ]);

      if (crRes.success && crRes.changeRequest) {
        setChangeRequest(crRes.changeRequest);
        setReviewStatus(crRes.changeRequest.status);
        setImplementationNotes(crRes.changeRequest.implementationNotes || '');
        setEditFormData({
          title: crRes.changeRequest.title,
          description: crRes.changeRequest.description,
          reason: crRes.changeRequest.reason,
          priority: crRes.changeRequest.priority
        });
      }

      if (projRes.success && projRes.project) {
        setProject(projRes.project);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load change request details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchChangeRequestDetails();
  }, [projectId, changeRequestId]);

  const isOwner = project && user && project.owner?._id === user.id;
  const isAdmin = user && user.role === 'admin';
  const isOwnerOrAdmin = isOwner || isAdmin;
  const isRequester = changeRequest && user && changeRequest.requestedBy?._id === user.id;

  const canReview = isOwnerOrAdmin;
  const canEdit = isOwnerOrAdmin || isRequester;
  const canDelete = isOwnerOrAdmin;

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewError('');

    try {
      setIsReviewing(true);
      const response = await changeRequestService.reviewChangeRequest(projectId, changeRequestId, {
        status: reviewStatus,
        implementationNotes
      });

      if (response.success && response.changeRequest) {
        setChangeRequest(response.changeRequest);
        setShowReviewModal(false);
        setSuccessMessage(`Change request status transitioned to '${statusLabels[response.changeRequest.status] || response.changeRequest.status}' successfully.`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setReviewError(error.message || 'Failed to review change request');
    } finally {
      setIsReviewing(false);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');

    try {
      setIsEditing(true);
      const response = await changeRequestService.updateChangeRequest(projectId, changeRequestId, editFormData);

      if (response.success && response.changeRequest) {
        setChangeRequest(response.changeRequest);
        setShowEditModal(false);
        setSuccessMessage('Change request details updated successfully.');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setEditError(error.message || 'Failed to update change request');
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteCR = async () => {
    try {
      setIsDeleting(true);
      const response = await changeRequestService.deleteChangeRequest(projectId, changeRequestId);
      if (response.success) {
        navigate(`/projects/${projectId}`, { replace: true });
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to delete change request');
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
          <p>Loading change request details...</p>
        </div>
      </div>
    );
  }

  if (!changeRequest) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <main className="main-content">
          <div className="empty-state-card">
            <h3>Change Request Not Found</h3>
            <p>The requested change request could not be found or has been removed.</p>
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
          <span className="breadcrumb-current">CR #{changeRequest._id.slice(-6).toUpperCase()}</span>
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

        {/* CR Header Card */}
        <div className="project-detail-header card">
          <div className="header-info">
            <div className="key-and-status">
              <span className="badge-tag cr-tag">CR-{changeRequest._id.slice(-6).toUpperCase()}</span>
              <span className={`status-pill status-${changeRequest.status}`}>
                {statusLabels[changeRequest.status] || changeRequest.status}
              </span>
              <span className={`priority-badge priority-${changeRequest.priority}`}>
                Priority: {priorityLabels[changeRequest.priority] || changeRequest.priority}
              </span>
            </div>
            <h1 className="project-detail-title">{changeRequest.title}</h1>
            <p className="detail-subtitle">
              Submitted by <strong>{changeRequest.requestedBy?.name || 'Unknown'}</strong> on {new Date(changeRequest.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="header-actions">
            {canReview && (
              <button
                onClick={() => {
                  setReviewStatus(changeRequest.status);
                  setImplementationNotes(changeRequest.implementationNotes || '');
                  setReviewError('');
                  setShowReviewModal(true);
                }}
                className="btn-action-primary"
                id="btn-open-review-modal"
              >
                ⚖️ Review & Approve
              </button>
            )}

            {canEdit && (
              <button
                onClick={() => {
                  setEditFormData({
                    title: changeRequest.title,
                    description: changeRequest.description,
                    reason: changeRequest.reason,
                    priority: changeRequest.priority
                  });
                  setEditError('');
                  setShowEditModal(true);
                }}
                className="btn-secondary"
                id="btn-open-edit-cr"
              >
                ✏️ Edit Details
              </button>
            )}

            {canDelete && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn-danger-outline"
                id="btn-open-delete-cr"
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </div>

        {/* Details Grid */}
        <div className="details-grid">
          {/* Main CR Description Card */}
          <div className="card info-card">
            <div className="card-header">
              <h3>Change Justification & Details</h3>
            </div>
            <div className="card-body">
              <div className="cr-section-block">
                <h4 style={{ fontSize: '0.95rem', color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 700 }}>
                  Business Reason / Justification
                </h4>
                <div style={{ background: '#f8fafc', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #e2e8f0', color: '#1e293b' }}>
                  <p style={{ margin: 0, whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>{changeRequest.reason}</p>
                </div>
              </div>

              <div className="cr-section-block" style={{ marginTop: '1.5rem' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 700 }}>
                  Detailed Description & Impact
                </h4>
                <p style={{ whiteSpace: 'pre-wrap', lineHeight: '1.6', margin: 0 }}>{changeRequest.description}</p>
              </div>

              <div className="cr-section-block" style={{ marginTop: '1.5rem', paddingTop: '1.25rem', borderTop: '1px solid var(--border-color)' }}>
                <h4 style={{ fontSize: '0.95rem', color: '#475569', textTransform: 'uppercase', marginBottom: '0.5rem', fontWeight: 700 }}>
                  Implementation & Review Notes
                </h4>
                {changeRequest.implementationNotes ? (
                  <div style={{ background: '#eff6ff', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid #bfdbfe', color: '#1e40af' }}>
                    <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{changeRequest.implementationNotes}</p>
                  </div>
                ) : (
                  <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', margin: 0 }}>
                    No implementation or review notes provided yet. The project lead will record review comments upon evaluation.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Governance & Metadata Card */}
          <div className="card members-card">
            <div className="card-header">
              <h3>Governance & Status</h3>
            </div>
            <div className="card-body">
              <div className="meta-list">
                <div className="meta-row">
                  <span className="meta-label">Workflow Status</span>
                  <span className="meta-value">
                    <span className={`status-pill status-${changeRequest.status}`}>
                      {statusLabels[changeRequest.status] || changeRequest.status}
                    </span>
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Priority Level</span>
                  <span className="meta-value">
                    <span className={`priority-badge priority-${changeRequest.priority}`}>
                      {priorityLabels[changeRequest.priority] || changeRequest.priority}
                    </span>
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Requested By</span>
                  <span className="meta-value">
                    <strong>{changeRequest.requestedBy?.name}</strong> ({changeRequest.requestedBy?.email}) &mdash;{' '}
                    <span className={`role-badge role-${changeRequest.requestedBy?.role}`}>
                      {roleLabels[changeRequest.requestedBy?.role] || changeRequest.requestedBy?.role}
                    </span>
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Reviewed By</span>
                  <span className="meta-value" id="cr-reviewed-by">
                    {changeRequest.reviewedBy ? (
                      <span>
                        <strong>{changeRequest.reviewedBy.name}</strong> ({changeRequest.reviewedBy.email}) &mdash;{' '}
                        <span className={`role-badge role-${changeRequest.reviewedBy.role}`}>
                          {roleLabels[changeRequest.reviewedBy.role] || changeRequest.reviewedBy.role}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                        ⏳ Pending Lead Review
                      </span>
                    )}
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Submitted On</span>
                  <span className="meta-value">{new Date(changeRequest.createdAt).toLocaleString()}</span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Last Updated</span>
                  <span className="meta-value">{new Date(changeRequest.updatedAt).toLocaleString()}</span>
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
                Baseline linkages between this change request, release milestones, and Unity Version Control.
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
                  Target Software Version
                </span>
                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 500 }}>
                  Not linked yet
                </span>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Version milestone assignment will be linked in upcoming release planning module.
                </p>
              </div>

              <div className="trace-item" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Unity Version Control Branch
                </span>
                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 500 }}>
                  Not linked yet
                </span>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Unity Version Control feature branches and merge records are tracked separately.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Review & Transition Modal */}
        {showReviewModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Review & Governance Sign-off</h3>
                <button
                  onClick={() => setShowReviewModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {reviewError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{reviewError}</span>
                </div>
              )}

              <form onSubmit={handleReviewSubmit} className="modal-form">
                <div className="form-group">
                  <label htmlFor="select-cr-status">Workflow Status Transition *</label>
                  <select
                    id="select-cr-status"
                    value={reviewStatus}
                    onChange={(e) => setReviewStatus(e.target.value)}
                    disabled={isReviewing}
                    required
                  >
                    <option value="submitted">Submitted (Under Initial Queue)</option>
                    <option value="under_review">Under Review (Evaluating Impact)</option>
                    <option value="approved">Approved (Authorized for Implementation)</option>
                    <option value="rejected">Rejected (Not Approved)</option>
                    <option value="implemented">Implemented (Changes Applied & Verified)</option>
                    <option value="cancelled">Cancelled (Withdrawn)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="input-cr-notes">Implementation / Review Notes</label>
                  <textarea
                    id="input-cr-notes"
                    rows="3"
                    placeholder="Provide justification for approval/rejection or instructions for developer..."
                    value={implementationNotes}
                    onChange={(e) => setImplementationNotes(e.target.value)}
                    disabled={isReviewing}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowReviewModal(false)}
                    className="btn-secondary"
                    disabled={isReviewing}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-save-review"
                    disabled={isReviewing}
                  >
                    {isReviewing ? 'Submitting Review...' : 'Save Decision'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Modal */}
        {showEditModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Edit Change Request</h3>
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
                  <label htmlFor="edit-cr-title">Change Title *</label>
                  <input
                    id="edit-cr-title"
                    type="text"
                    value={editFormData.title}
                    onChange={(e) => setEditFormData({ ...editFormData, title: e.target.value })}
                    disabled={isEditing}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-cr-priority">Priority Level</label>
                  <select
                    id="edit-cr-priority"
                    value={editFormData.priority}
                    onChange={(e) => setEditFormData({ ...editFormData, priority: e.target.value })}
                    disabled={isEditing}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-cr-reason">Business Justification / Reason *</label>
                  <textarea
                    id="edit-cr-reason"
                    rows="2"
                    value={editFormData.reason}
                    onChange={(e) => setEditFormData({ ...editFormData, reason: e.target.value })}
                    disabled={isEditing}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-cr-desc">Detailed Description *</label>
                  <textarea
                    id="edit-cr-desc"
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
                    id="btn-save-edit-cr"
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
                <h3>Confirm Change Request Deletion</h3>
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
                  Are you sure you want to delete this change request: <strong>{changeRequest.title}</strong>?
                </p>
                <p className="warning-text">
                  This action will permanently delete this change request and all review history from MongoDB.
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
                  onClick={handleDeleteCR}
                  className="btn-danger"
                  id="btn-confirm-delete-cr"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Change Request'}
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

export default ChangeRequestDetails;
