import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { versionService, projectService, uvcsService } from '../services/api';

const versionStatusLabels = {
  development: 'In Development',
  testing: 'In Testing / QA',
  released: 'Released',
  deprecated: 'Deprecated'
};

const VersionDetails = () => {
  const { projectId, versionId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [version, setVersion] = useState(null);
  const [project, setProject] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showUvcsModal, setShowUvcsModal] = useState(false);

  // UVCS Linking state
  const [uvcsChangesets, setUvcsChangesets] = useState([]);
  const [selectedChangesetId, setSelectedChangesetId] = useState('');
  const [isLoadingUvcs, setIsLoadingUvcs] = useState(false);
  const [isLinkingUvcs, setIsLinkingUvcs] = useState(false);
  const [uvcsModalError, setUvcsModalError] = useState('');

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    versionNumber: '',
    name: '',
    description: '',
    status: 'development',
    releaseDate: '',
    changes: ['']
  });
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchVersionData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const [verRes, projRes] = await Promise.all([
        versionService.getVersionById(projectId, versionId),
        projectService.getProjectById(projectId)
      ]);

      if (verRes.success && verRes.version) {
        setVersion(verRes.version);
        setEditFormData({
          versionNumber: verRes.version.versionNumber,
          name: verRes.version.name,
          description: verRes.version.description || '',
          status: verRes.version.status,
          releaseDate: verRes.version.releaseDate
            ? new Date(verRes.version.releaseDate).toISOString().split('T')[0]
            : '',
          changes: verRes.version.changes && verRes.version.changes.length > 0
            ? [...verRes.version.changes]
            : ['']
        });
      }

      if (projRes.success && projRes.project) {
        setProject(projRes.project);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load software version details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchVersionData();
  }, [projectId, versionId]);

  const isOwner = project && user && project.owner?._id === user.id;
  const isAdmin = user && user.role === 'admin';
  const canManage = isOwner || isAdmin;

  // Change items handlers in edit form
  const handleAddChangeField = () => {
    setEditFormData(prev => ({
      ...prev,
      changes: [...prev.changes, '']
    }));
  };

  const handleRemoveChangeField = (index) => {
    setEditFormData(prev => ({
      ...prev,
      changes: prev.changes.filter((_, idx) => idx !== index)
    }));
  };

  const handleChangeFieldChange = (index, value) => {
    setEditFormData(prev => {
      const updated = [...prev.changes];
      updated[index] = value;
      return { ...prev, changes: updated };
    });
  };

  const handleOpenEditModal = () => {
    setEditError('');
    setSuccessMessage('');
    if (version) {
      setEditFormData({
        versionNumber: version.versionNumber,
        name: version.name,
        description: version.description || '',
        status: version.status,
        releaseDate: version.releaseDate
          ? new Date(version.releaseDate).toISOString().split('T')[0]
          : '',
        changes: version.changes && version.changes.length > 0
          ? [...version.changes]
          : ['']
      });
    }
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');
    setSuccessMessage('');

    if (!editFormData.versionNumber.trim() || !editFormData.name.trim()) {
      setEditError('Version number and name are required.');
      return;
    }

    try {
      setIsUpdating(true);
      const cleanChanges = editFormData.changes.map(c => c.trim()).filter(Boolean);

      const response = await versionService.updateVersion(projectId, versionId, {
        ...editFormData,
        changes: cleanChanges
      });

      if (response.success && response.version) {
        setVersion(response.version);
        setEditFormData({
          versionNumber: response.version.versionNumber,
          name: response.version.name,
          description: response.version.description || '',
          status: response.version.status,
          releaseDate: response.version.releaseDate
            ? new Date(response.version.releaseDate).toISOString().split('T')[0]
            : '',
          changes: response.version.changes && response.version.changes.length > 0
            ? [...response.version.changes]
            : ['']
        });
        setShowEditModal(false);
        setSuccessMessage('Version configuration updated successfully.');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setEditError(error.message || 'Failed to update version');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteVersion = async () => {
    try {
      const response = await versionService.deleteVersion(projectId, versionId);
      if (response.success) {
        navigate(`/projects/${projectId}`, { replace: true });
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to delete version');
      setShowDeleteModal(false);
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
        if (version?.uvcs?.changesetId !== null && version?.uvcs?.changesetId !== undefined) {
          setSelectedChangesetId(String(version.uvcs.changesetId));
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
      const res = await versionService.linkUvcs(projectId, versionId, {
        changesetId: Number(selectedChangesetId),
        branch: selectedObj ? selectedObj.branch : '/main',
        repository: 'default@local'
      });
      if (res.success) {
        setSuccessMessage(res.message || 'UVCS baseline linked successfully!');
        setShowUvcsModal(false);
        fetchVersionData();
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
    if (!window.confirm('Are you sure you want to unlink the UVCS baseline from this version?')) return;
    try {
      const res = await versionService.linkUvcs(projectId, versionId, { changesetId: null });
      if (res.success) {
        setSuccessMessage('UVCS baseline unlinked successfully');
        setShowUvcsModal(false);
        fetchVersionData();
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
          <p>Loading version configuration...</p>
        </div>
      </div>
    );
  }

  if (!version) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <main className="main-content">
          <div className="empty-state-card">
            <h3>Version Not Found</h3>
            <p>The requested version does not exist or has been removed from this project.</p>
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
            {project?.name || 'Project'} ({project?.key})
          </Link>
          <span className="breadcrumb-sep">&gt;</span>
          <span className="breadcrumb-current">v{version.versionNumber}</span>
        </nav>

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

        {/* Header Card */}
        <div className="project-detail-header card">
          <div className="header-info">
            <div className="key-and-status">
              <span className="version-number-tag large" id="version-display-number">
                v{version.versionNumber}
              </span>
              <span className={`status-pill status-${version.status}`} id="version-display-status">
                {versionStatusLabels[version.status] || version.status}
              </span>
            </div>
            <h1 className="project-detail-title" id="version-display-name">{version.name}</h1>
            <p className="project-detail-description">
              {version.description || 'No version release description provided.'}
            </p>
          </div>

          {canManage && (
            <div className="header-actions">
              <button
                onClick={handleOpenEditModal}
                className="btn-secondary"
                id="btn-edit-version"
              >
                ✏️ Edit Version
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn-danger-outline"
                id="btn-delete-version"
              >
                🗑️ Delete Version
              </button>
            </div>
          )}
        </div>

        {/* Details & SCM Baseline Grid */}
        <div className="details-grid">
          {/* Version Metadata */}
          <div className="card info-card">
            <div className="card-header">
              <h3>Version Metadata</h3>
              <span className="badge-upcoming">Release Info</span>
            </div>
            <div className="card-body">
              <div className="meta-list">
                <div className="meta-row">
                  <span className="meta-label">Project</span>
                  <span className="meta-value">
                    <strong>{project?.name}</strong> (<code>{project?.key}</code>)
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Created By</span>
                  <span className="meta-value">
                    {version.createdBy?.name} ({version.createdBy?.email})
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Target Release Date</span>
                  <span className="meta-value">
                    {version.releaseDate
                      ? new Date(version.releaseDate).toLocaleDateString()
                      : 'Not scheduled'}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Created Timestamp</span>
                  <span className="meta-value">
                    {new Date(version.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Last Updated</span>
                  <span className="meta-value">
                    {new Date(version.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Unity Version Control Baseline Card */}
          <div className="card baseline-card" id="card-version-uvcs-baseline">
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3>Unity VCS Baseline</h3>
              {version.uvcs?.changesetId !== null && version.uvcs?.changesetId !== undefined ? (
                <span className="status-pill status-published" id="badge-uvcs-linked">
                  ● Linked (cs:{version.uvcs.changesetId})
                </span>
              ) : (
                <span className="status-pill status-deprecated" id="badge-uvcs-unlinked">
                  ○ Not Linked
                </span>
              )}
            </div>
            <div className="card-body">
              {version.uvcs?.changesetId !== null && version.uvcs?.changesetId !== undefined ? (
                <div className="baseline-content">
                  <p className="baseline-intro" style={{ marginBottom: '1rem' }}>
                    Software version <strong>v{version.versionNumber}</strong> is anchored to verified Unity Version Control baseline:
                  </p>
                  <div className="meta-list" style={{ marginBottom: '1rem' }}>
                    <div className="meta-row">
                      <span className="meta-label">Changeset:</span>
                      <span className="meta-value" id="version-uvcs-changeset">
                        <span className="status-pill status-in_progress" style={{ fontWeight: 600 }}>
                          cs:{version.uvcs.changesetId}
                        </span>
                      </span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Branch:</span>
                      <span className="meta-value" id="version-uvcs-branch">
                        <strong>{version.uvcs.branch || '/main'}</strong>
                      </span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Repository:</span>
                      <span className="meta-value" id="version-uvcs-repo">
                        <code>{version.uvcs.repository || 'default@local'}</code>
                      </span>
                    </div>
                  </div>

                  {canManage && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem' }}>
                      <button
                        type="button"
                        onClick={handleOpenUvcsModal}
                        className="btn-action-primary-small"
                        id="btn-change-version-uvcs"
                      >
                        🔗 Change Baseline
                      </button>
                      <button
                        type="button"
                        onClick={handleUnlinkUvcs}
                        className="btn-danger-outline"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        id="btn-unlink-version-uvcs"
                      >
                        Unlink
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="baseline-content">
                  <p className="text-muted" style={{ margin: '0 0 1rem 0', fontSize: '0.9rem' }}>
                    No Unity Version Control baseline linked to this version yet. Linking an official changeset establishes a verified source-code milestone.
                  </p>
                  {canManage && (
                    <button
                      type="button"
                      onClick={handleOpenUvcsModal}
                      className="btn-action-primary"
                      id="btn-open-link-version-uvcs"
                    >
                      🔗 Link UVCS Baseline
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Recorded Changes List */}
        <section className="changes-section card">
          <div className="card-header">
            <h3>Recorded Changes ({version.changes?.length || 0})</h3>
            {canManage && (
              <button
                onClick={handleOpenEditModal}
                className="btn-action-primary-small"
              >
                + Add / Modify Changes
              </button>
            )}
          </div>
          <div className="card-body">
            {version.changes && version.changes.length > 0 ? (
              <ul className="changes-list">
                {version.changes.map((change, idx) => (
                  <li key={idx} className="change-entry">
                    <span className="change-bullet">✓</span>
                    <span className="change-text">{change}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="no-members-note">
                No individual change entries recorded yet for this software version.
              </p>
            )}
          </div>
        </section>

        {/* Edit Version Modal */}
        {showEditModal && (
          <div className="modal-overlay">
            <div className="modal-card modal-large">
              <div className="modal-header">
                <h3>Edit Version Configuration</h3>
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
                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="edit-ver-num">Version Number *</label>
                    <input
                      id="edit-ver-num"
                      type="text"
                      value={editFormData.versionNumber}
                      onChange={(e) => setEditFormData({ ...editFormData, versionNumber: e.target.value })}
                      disabled={isUpdating}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-ver-name">Version Name *</label>
                    <input
                      id="edit-ver-name"
                      type="text"
                      value={editFormData.name}
                      onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                      disabled={isUpdating}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="edit-ver-status">Lifecycle Status</label>
                    <select
                      id="edit-ver-status"
                      value={editFormData.status}
                      onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                      disabled={isUpdating}
                    >
                      <option value="development">In Development</option>
                      <option value="testing">In Testing / QA</option>
                      <option value="released">Released</option>
                      <option value="deprecated">Deprecated</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-ver-date">Release Date</label>
                    <input
                      id="edit-ver-date"
                      type="date"
                      value={editFormData.releaseDate}
                      onChange={(e) => setEditFormData({ ...editFormData, releaseDate: e.target.value })}
                      disabled={isUpdating}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-ver-desc">Description</label>
                  <textarea
                    id="edit-ver-desc"
                    rows="3"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    disabled={isUpdating}
                  />
                </div>

                {/* Multiple Change Entries */}
                <div className="form-group">
                  <div className="label-row-between">
                    <label>Recorded Change Entries</label>
                    <button
                      type="button"
                      onClick={handleAddChangeField}
                      className="btn-link-small"
                      id="btn-add-change-field"
                    >
                      + Add Change Entry
                    </button>
                  </div>
                  <div className="changes-input-container">
                    {editFormData.changes.map((item, idx) => (
                      <div key={idx} className="change-input-row">
                        <input
                          type="text"
                          placeholder="e.g. Added authentication, Fixed validation error"
                          value={item}
                          onChange={(e) => handleChangeFieldChange(idx, e.target.value)}
                          className="input-change-item"
                          disabled={isUpdating}
                        />
                        {editFormData.changes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveChangeField(idx)}
                            className="btn-remove-row"
                            title="Remove change entry"
                          >
                            &times;
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
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
                    id="btn-save-version-edit"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Saving Version...' : 'Save Changes'}
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
                <h3>Confirm Version Deletion</h3>
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
                  Are you sure you want to delete <strong>v{version.versionNumber} ({version.name})</strong>?
                </p>
                <p className="warning-text">
                  This action will remove this software version baseline and all recorded changes from the database.
                </p>
              </div>

              <div className="modal-actions">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteVersion}
                  className="btn-danger"
                  id="btn-confirm-delete-version"
                >
                  Yes, Delete Version
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Link UVCS Baseline Modal */}
        {showUvcsModal && (
          <div className="modal-overlay" id="modal-link-uvcs">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Link Unity VCS Baseline</h3>
                <button
                  type="button"
                  onClick={() => setShowUvcsModal(false)}
                  className="btn-modal-close"
                  id="btn-close-link-uvcs"
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
                  <label htmlFor="select-changeset">Select Verified Repository Changeset *</label>
                  {isLoadingUvcs ? (
                    <p className="text-muted">Loading changesets from Unity Version Control...</p>
                  ) : (
                    <select
                      id="select-changeset"
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
                    Only real changesets verified in repository <code>default@local</code> are selectable.
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
                    id="btn-submit-link-uvcs"
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

export default VersionDetails;
