import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { releaseService, uvcsService } from '../services/api';

const statusLabels = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  published: 'Published',
  withdrawn: 'Withdrawn'
};

const roleLabels = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  developer: 'Developer',
  tester: 'QA / Tester'
};

const severityLabels = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const priorityLabels = {
  urgent: 'Urgent',
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const ReleaseDetails = () => {
  const { projectId, releaseId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [release, setRelease] = useState(null);
  const [relatedCRs, setRelatedCRs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Workflow actions state
  const [isGeneratingNotes, setIsGeneratingNotes] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // UVCS Linking state
  const [showUvcsModal, setShowUvcsModal] = useState(false);
  const [uvcsChangesets, setUvcsChangesets] = useState([]);
  const [selectedChangesetId, setSelectedChangesetId] = useState('');
  const [isLoadingUvcs, setIsLoadingUvcs] = useState(false);
  const [isLinkingUvcs, setIsLinkingUvcs] = useState(false);
  const [uvcsModalError, setUvcsModalError] = useState('');

  // Edit release state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editFormData, setEditFormData] = useState({
    releaseName: '',
    description: '',
    releaseDate: '',
    releaseNotes: ''
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [editError, setEditError] = useState('');

  // Delete release state
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchReleaseDetails = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const response = await releaseService.getReleaseById(projectId, releaseId);

      if (response.success && response.release) {
        setRelease(response.release);
        setRelatedCRs(response.relatedChangeRequests || []);
        setEditFormData({
          releaseName: response.release.releaseName,
          description: response.release.description || '',
          releaseDate: response.release.releaseDate
            ? new Date(response.release.releaseDate).toISOString().split('T')[0]
            : '',
          releaseNotes: response.release.releaseNotes || ''
        });
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load release details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReleaseDetails();
  }, [projectId, releaseId]);

  const project = release?.project;
  const version = release?.version;

  const isOwner = project && user && project.owner === user.id;
  const isAdmin = user && user.role === 'admin';
  const canManage = isOwner || isAdmin;

  // 1. Generate Release Notes handler
  const handleGenerateReleaseNotes = async () => {
    try {
      setIsGeneratingNotes(true);
      setErrorMessage('');

      const response = await releaseService.generateReleaseNotes(projectId, releaseId);

      if (response.success && response.release) {
        setRelease(response.release);
        setEditFormData((prev) => ({
          ...prev,
          releaseNotes: response.release.releaseNotes
        }));
        setSuccessMessage('Release notes generated successfully from live project data!');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to generate release notes');
    } finally {
      setIsGeneratingNotes(false);
    }
  };

  // 2. Workflow transitions
  const handleStatusTransition = async (newStatus) => {
    try {
      setIsTransitioning(true);
      setErrorMessage('');

      let response;
      if (newStatus === 'approved') {
        response = await releaseService.approveRelease(projectId, releaseId);
      } else if (newStatus === 'published') {
        response = await releaseService.publishRelease(projectId, releaseId);
      } else {
        response = await releaseService.updateRelease(projectId, releaseId, { status: newStatus });
      }

      if (response.success && response.release) {
        setRelease(response.release);
        setSuccessMessage(`Release status transitioned to '${statusLabels[response.release.status] || response.release.status}'!`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to update release status');
    } finally {
      setIsTransitioning(false);
    }
  };

  // 3. Edit release handler
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');

    try {
      setIsUpdating(true);
      const response = await releaseService.updateRelease(projectId, releaseId, editFormData);

      if (response.success && response.release) {
        setRelease(response.release);
        setShowEditModal(false);
        setSuccessMessage('Release configuration updated successfully.');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setEditError(error.message || 'Failed to update release');
    } finally {
      setIsUpdating(false);
    }
  };

  // 4. Delete release handler
  const handleDeleteRelease = async () => {
    try {
      setIsDeleting(true);
      const response = await releaseService.deleteRelease(projectId, releaseId);
      if (response.success) {
        navigate(`/projects/${projectId}`, { replace: true });
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to delete release');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenUvcsModal = async () => {
    setUvcsModalError('');
    setIsLoadingUvcs(true);
    setShowUvcsModal(true);
    try {
      const res = await uvcsService.getChangesets();
      if (res.success && res.changesets) {
        setUvcsChangesets(res.changesets);
        if (release?.uvcs?.changesetId !== null && release?.uvcs?.changesetId !== undefined) {
          setSelectedChangesetId(String(release.uvcs.changesetId));
        } else if (res.changesets.length > 0) {
          setSelectedChangesetId(String(res.changesets[0].changesetId));
        }
      }
    } catch (err) {
      setUvcsModalError('Failed to load UVCS changesets: ' + err.message);
    } finally {
      setIsLoadingUvcs(false);
    }
  };

  const handleSaveUvcsLink = async (e) => {
    e.preventDefault();
    setUvcsModalError('');
    setIsLinkingUvcs(true);
    try {
      const selectedObj = uvcsChangesets.find(cs => String(cs.changesetId) === String(selectedChangesetId));
      const res = await releaseService.linkUvcs(projectId, releaseId, {
        changesetId: Number(selectedChangesetId),
        branch: selectedObj ? selectedObj.branch : '/main',
        repository: 'default@local'
      });
      if (res.success) {
        setSuccessMessage(res.message || 'UVCS baseline linked to release successfully!');
        setShowUvcsModal(false);
        fetchReleaseData();
      } else {
        setUvcsModalError(res.message || 'Failed to link baseline');
      }
    } catch (err) {
      setUvcsModalError(err.message || 'Error linking UVCS baseline');
    } finally {
      setIsLinkingUvcs(false);
    }
  };

  const handleUnlinkUvcs = async () => {
    if (!window.confirm('Are you sure you want to unlink the UVCS baseline from this release?')) return;
    try {
      const res = await releaseService.linkUvcs(projectId, releaseId, { changesetId: null });
      if (res.success) {
        setSuccessMessage('UVCS baseline unlinked successfully');
        setShowUvcsModal(false);
        fetchReleaseData();
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error unlinking UVCS baseline');
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <div className="page-loading-state">
          <div className="spinner"></div>
          <p>Loading release governance details...</p>
        </div>
      </div>
    );
  }

  if (!release) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <main className="main-content">
          <div className="empty-state-card">
            <h3>Release Not Found</h3>
            <p>The requested release record could not be found or has been removed.</p>
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
          <span className="breadcrumb-current">Release: {release.releaseName}</span>
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

        {/* Release Header Card */}
        <div className="project-detail-header card">
          <div className="header-info">
            <div className="key-and-status">
              <span className="project-key-tag large">{project?.key}</span>
              <span className="version-number-tag large">
                v{version?.versionNumber || '1.0.0'}
              </span>
              <span className={`status-pill status-${release.status}`} id="release-status-pill">
                {statusLabels[release.status] || release.status}
              </span>
            </div>
            <h1 className="project-detail-title">{release.releaseName}</h1>
            <p className="detail-subtitle">
              Created by <strong>{release.createdBy?.name || 'Unknown'}</strong> on{' '}
              {new Date(release.createdAt).toLocaleDateString()}
              {release.approvedBy && (
                <span>
                  {' '}&bull; Approved by <strong>{release.approvedBy.name}</strong>
                </span>
              )}
              {release.releaseDate && (
                <span>
                  {' '}&bull; Target Date: <strong>{new Date(release.releaseDate).toLocaleDateString()}</strong>
                </span>
              )}
            </p>
            {release.description && (
              <p className="project-detail-description">{release.description}</p>
            )}
          </div>

          <div className="header-actions">
            {/* Generate Notes Button */}
            {canManage && (
              <button
                onClick={handleGenerateReleaseNotes}
                disabled={isGeneratingNotes}
                className="btn-action-primary"
                id="btn-generate-notes"
              >
                {isGeneratingNotes ? 'Generating...' : '📝 Generate Release Notes'}
              </button>
            )}

            {/* Workflow Progression Controls */}
            {canManage && release.status === 'draft' && (
              <button
                onClick={() => handleStatusTransition('pending_approval')}
                disabled={isTransitioning}
                className="btn-secondary"
                id="btn-submit-approval"
              >
                📤 Submit for Approval
              </button>
            )}

            {canManage && release.status === 'pending_approval' && (
              <button
                onClick={() => handleStatusTransition('approved')}
                disabled={isTransitioning}
                className="btn-secondary"
                id="btn-approve-release"
              >
                👍 Approve Release
              </button>
            )}

            {canManage && (release.status === 'approved' || release.status === 'pending_approval') && (
              <button
                onClick={() => handleStatusTransition('published')}
                disabled={isTransitioning}
                className="btn-primary-small"
                id="btn-publish-release"
              >
                🚀 Publish Release
              </button>
            )}

            {canManage && release.status !== 'withdrawn' && release.status !== 'published' && (
              <button
                onClick={() => handleStatusTransition('withdrawn')}
                disabled={isTransitioning}
                className="btn-secondary"
                id="btn-withdraw-release"
              >
                Withdraw
              </button>
            )}

            {canManage && (
              <button
                onClick={() => {
                  setEditError('');
                  setShowEditModal(true);
                }}
                className="btn-secondary"
                id="btn-open-edit-release"
              >
                ✏️ Edit
              </button>
            )}

            {canManage && (
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn-danger-outline"
                id="btn-open-delete-release"
              >
                🗑️ Delete
              </button>
            )}
          </div>
        </div>

        {/* Release Metadata Grid */}
        <div className="details-grid">
          {/* Main Release Notes & Description Card */}
          <div className="card info-card">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Release Notes</h3>
              {release.releaseNotes && (
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(release.releaseNotes);
                    setSuccessMessage('Release notes copied to clipboard!');
                    setTimeout(() => setSuccessMessage(''), 3000);
                  }}
                  className="btn-link-small"
                >
                  📋 Copy Markdown
                </button>
              )}
            </div>
            <div className="card-body">
              {release.releaseNotes ? (
                <div
                  className="release-notes-preview"
                  id="release-notes-container"
                  style={{
                    background: '#f8fafc',
                    padding: '1.25rem',
                    borderRadius: '8px',
                    border: '1px solid #e2e8f0',
                    fontFamily: 'monospace',
                    fontSize: '0.9rem',
                    whiteSpace: 'pre-wrap',
                    lineHeight: '1.6',
                    maxHeight: '480px',
                    overflowY: 'auto'
                  }}
                >
                  {release.releaseNotes}
                </div>
              ) : (
                <div className="empty-state-banner" style={{ padding: '1.5rem', background: '#f8fafc', borderRadius: '8px', border: '1px dashed #cbd5e1', textAlign: 'center' }}>
                  <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                    No release notes generated yet. Click <strong>"📝 Generate Release Notes"</strong> above to automatically compile notes from version changes, resolved bugs, and approved change requests.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Scope & Governance Attribution Card */}
          <div className="card members-card">
            <div className="card-header">
              <h3>Governance & Baseline</h3>
            </div>
            <div className="card-body">
              <div className="meta-list">
                <div className="meta-row">
                  <span className="meta-label">Associated Version</span>
                  <span className="meta-value">
                    <strong>v{version?.versionNumber}</strong> &mdash; {version?.name} (
                    <span className={`status-pill status-${version?.status}`}>
                      {version?.status}
                    </span>
                    )
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Current Release Status</span>
                  <span className="meta-value">
                    <span className={`status-pill status-${release.status}`}>
                      {statusLabels[release.status] || release.status}
                    </span>
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Created By</span>
                  <span className="meta-value">
                    <strong>{release.createdBy?.name}</strong> ({release.createdBy?.email}) &mdash;{' '}
                    <span className={`role-badge role-${release.createdBy?.role}`}>
                      {roleLabels[release.createdBy?.role] || release.createdBy?.role}
                    </span>
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Approved By</span>
                  <span className="meta-value" id="release-approved-by">
                    {release.approvedBy ? (
                      <span>
                        <strong>{release.approvedBy.name}</strong> ({release.approvedBy.email}) &mdash;{' '}
                        <span className={`role-badge role-${release.approvedBy.role}`}>
                          {roleLabels[release.approvedBy.role] || release.approvedBy.role}
                        </span>
                      </span>
                    ) : (
                      <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                        ⏳ Pending Approval
                      </span>
                    )}
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Target Release Date</span>
                  <span className="meta-value">
                    {release.releaseDate
                      ? new Date(release.releaseDate).toLocaleDateString()
                      : 'Not scheduled'}
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Included Changes</span>
                  <span className="meta-value">
                    {release.includedChanges?.length || 0} change entries
                  </span>
                </div>

                <div className="meta-row">
                  <span className="meta-label">Resolved Defects</span>
                  <span className="meta-value">
                    {release.fixedBugs?.length || 0} fixed bugs
                  </span>
                </div>

                <div className="meta-row" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '0.75rem', marginTop: '0.5rem' }}>
                  <span className="meta-label">UVCS Baseline</span>
                  <span className="meta-value" id="release-uvcs-baseline-value">
                    {release.uvcs?.changesetId !== null && release.uvcs?.changesetId !== undefined ? (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span className="status-pill status-in_progress" style={{ fontWeight: 600 }}>
                          cs:{release.uvcs.changesetId}
                        </span>
                        <span>on <strong>{release.uvcs.branch}</strong></span>
                        <code style={{ fontSize: '0.75rem' }}>({release.uvcs.repository})</code>
                        {canManage && (
                          <button
                            type="button"
                            onClick={handleOpenUvcsModal}
                            className="btn-link-small"
                            id="btn-change-release-uvcs"
                          >
                            Change
                          </button>
                        )}
                        {canManage && (
                          <button
                            type="button"
                            onClick={handleUnlinkUvcs}
                            className="btn-link-small"
                            style={{ color: '#ef4444' }}
                            id="btn-unlink-release-uvcs"
                          >
                            Unlink
                          </button>
                        )}
                      </span>
                    ) : (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className="text-muted" style={{ fontStyle: 'italic' }}>Not linked</span>
                        {canManage && (
                          <button
                            type="button"
                            onClick={handleOpenUvcsModal}
                            className="btn-action-primary-small"
                            id="btn-open-link-release-uvcs"
                          >
                            🔗 Link UVCS
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Section: Included Changes from Software Version */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3>Included Features & Baseline Changes ({release.includedChanges?.length || 0})</h3>
          </div>
          <div className="card-body">
            {release.includedChanges && release.includedChanges.length > 0 ? (
              <ul className="changes-list" style={{ margin: 0, paddingLeft: '1.25rem' }}>
                {release.includedChanges.map((change, idx) => (
                  <li key={idx} style={{ marginBottom: '0.4rem', lineHeight: '1.5' }}>
                    {change}
                  </li>
                ))}
              </ul>
            ) : (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No specific change entries attached to this release baseline.
              </p>
            )}
          </div>
        </div>

        {/* Section: Resolved Defects Included in this Release */}
        <div className="card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3>Resolved Defects ({release.fixedBugs?.length || 0})</h3>
          </div>
          <div className="card-body">
            {release.fixedBugs && release.fixedBugs.length > 0 ? (
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Bug ID</th>
                      <th>Title</th>
                      <th>Severity</th>
                      <th>Priority</th>
                      <th>Resolution Notes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {release.fixedBugs.map((bug) => (
                      <tr key={bug._id}>
                        <td>
                          <span className="badge-tag bug-tag">
                            BUG-{bug._id.toString().slice(-6).toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <strong>{bug.title}</strong>
                        </td>
                        <td>
                          <span className={`severity-badge severity-${bug.severity}`}>
                            {severityLabels[bug.severity] || bug.severity}
                          </span>
                        </td>
                        <td>
                          <span className={`priority-badge priority-${bug.priority}`}>
                            {priorityLabels[bug.priority] || bug.priority}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: '0.85rem', color: '#166534' }}>
                            {bug.resolution || 'Resolved'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No defects linked yet. Generate release notes to automatically bind resolved defects to this release.
              </p>
            )}
          </div>
        </div>

        {/* Configuration Management Traceability Section */}
        <div className="card traceability-card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Configuration Management Traceability</h3>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Baseline linkages across software version releases, defects, change requests, and Unity Version Control.
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
                  Software Version Baseline
                </span>
                <strong style={{ fontSize: '1rem', color: '#1e293b' }}>v{version?.versionNumber}</strong>
                <span style={{ marginLeft: '0.5rem', fontSize: '0.85rem', color: '#64748b' }}>({version?.name})</span>
              </div>

              <div className="trace-item" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                  Unity Version Control Changeset
                </span>
                <span style={{ color: '#94a3b8', fontStyle: 'italic', fontWeight: 500 }}>
                  Not linked yet
                </span>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                  Unity Version Control check-ins and changesets are tracked separately.
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
                  Feature branches and release tags are managed directly in Unity Version Control.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Edit Release Modal */}
        {showEditModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Edit Release Configuration</h3>
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
                  <label htmlFor="edit-rel-name">Release Name *</label>
                  <input
                    id="edit-rel-name"
                    type="text"
                    value={editFormData.releaseName}
                    onChange={(e) => setEditFormData({ ...editFormData, releaseName: e.target.value })}
                    disabled={isUpdating}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-rel-date">Target Release Date</label>
                  <input
                    id="edit-rel-date"
                    type="date"
                    value={editFormData.releaseDate}
                    onChange={(e) => setEditFormData({ ...editFormData, releaseDate: e.target.value })}
                    disabled={isUpdating}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-rel-desc">Release Description</label>
                  <textarea
                    id="edit-rel-desc"
                    rows="3"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    disabled={isUpdating}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-rel-notes">Release Notes Markdown</label>
                  <textarea
                    id="edit-rel-notes"
                    rows="6"
                    style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}
                    value={editFormData.releaseNotes}
                    onChange={(e) => setEditFormData({ ...editFormData, releaseNotes: e.target.value })}
                    disabled={isUpdating}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowEditModal(false)}
                    className="btn-secondary"
                    disabled={isUpdating}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-save-edit-release"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Saving...' : 'Save Changes'}
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
                <h3>Confirm Release Deletion</h3>
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
                  Are you sure you want to delete this release: <strong>{release.releaseName}</strong>?
                </p>
                <p className="warning-text">
                  This action will permanently delete this release record and its generated release notes from MongoDB.
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
                  onClick={handleDeleteRelease}
                  className="btn-danger"
                  id="btn-confirm-delete-release"
                  disabled={isDeleting}
                >
                  {isDeleting ? 'Deleting...' : 'Yes, Delete Release'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Link UVCS Baseline Modal */}
        {showUvcsModal && (
          <div className="modal-overlay" id="modal-link-release-uvcs">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Link Unity VCS Baseline to Release</h3>
                <button
                  type="button"
                  onClick={() => setShowUvcsModal(false)}
                  className="btn-modal-close"
                  id="btn-close-link-release-uvcs"
                >
                  &times;
                </button>
              </div>

              {uvcsModalError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{uvcsModalError}</span>
                </div>
              )}

              <form onSubmit={handleSaveUvcsLink} className="modal-form">
                <div className="form-group">
                  <label htmlFor="select-release-changeset">Select Verified Repository Changeset *</label>
                  {isLoadingUvcs ? (
                    <p className="text-muted">Loading changesets from Unity Version Control...</p>
                  ) : (
                    <select
                      id="select-release-changeset"
                      value={selectedChangesetId}
                      onChange={(e) => setSelectedChangesetId(e.target.value)}
                      disabled={isLinkingUvcs}
                      required
                    >
                      {uvcsChangesets.map(cs => (
                        <option key={cs.changesetId} value={cs.changesetId}>
                          cs:{cs.changesetId} &mdash; {cs.branch} ({new Date(cs.date).toLocaleDateString()}) - {cs.owner || 'all'}
                        </option>
                      ))}
                    </select>
                  )}
                  <span className="form-hint">
                    Anchor this release governance record to an official baseline in <code>default@local</code>.
                  </span>
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowUvcsModal(false)}
                    className="btn-secondary"
                    disabled={isLinkingUvcs}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-action-primary"
                    disabled={isLinkingUvcs || isLoadingUvcs || uvcsChangesets.length === 0}
                    id="btn-submit-link-release-uvcs"
                  >
                    {isLinkingUvcs ? 'Linking...' : 'Save Baseline Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ReleaseDetails;
