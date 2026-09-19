import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { versionService, projectService, uvcsService, baselineService } from '../services/api';

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
  const [showChangesetModal, setShowChangesetModal] = useState(false);
  const [inspectingChangeset, setInspectingChangeset] = useState(null);
  const [isLoadingChangeset, setIsLoadingChangeset] = useState(false);
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [showCreateBaselineModal, setShowCreateBaselineModal] = useState(false);
  const [baselineFormData, setBaselineFormData] = useState({ name: '', description: '' });
  const [isCreatingBaseline, setIsCreatingBaseline] = useState(false);
  const [baselineModalError, setBaselineModalError] = useState('');

  // Source Control Baseline state
  const [baselineDoc, setBaselineDoc] = useState(null);
  const [uvcsStatus, setUvcsStatus] = useState(null);
  const [csDetails, setCsDetails] = useState(null);

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

      const [verRes, projRes, uvcsStatusRes, blRes] = await Promise.all([
        versionService.getVersionById(projectId, versionId),
        projectService.getProjectById(projectId),
        uvcsService.getStatus().catch(() => ({ success: false })),
        baselineService.getBaselines({ project: projectId, version: versionId }).catch(() => ({ success: false, baselines: [] }))
      ]);

      if (uvcsStatusRes.success && uvcsStatusRes.data) {
        setUvcsStatus(uvcsStatusRes.data);
      }

      if (blRes.success && blRes.baselines && blRes.baselines.length > 0) {
        setBaselineDoc(blRes.baselines[0]);
      } else {
        setBaselineDoc(null);
      }

      if (verRes.success && verRes.version) {
        setVersion(verRes.version);
        if (verRes.version.uvcs?.changesetId !== null && verRes.version.uvcs?.changesetId !== undefined) {
          try {
            const csRes = await uvcsService.getChangesetById(verRes.version.uvcs.changesetId, verRes.version.uvcs.repository || 'default@local');
            if (csRes.success && csRes.changeset) {
              setCsDetails(csRes.changeset);
            }
          } catch {
            // Keep existing state
          }
        }
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

  const handleViewChangeset = async (csId) => {
    try {
      setIsLoadingChangeset(true);
      setShowChangesetModal(true);
      setInspectingChangeset({ changesetId: csId, loading: true });

      const repo = baselineDoc?.repository || version?.uvcs?.repository || 'default@local';
      const res = await uvcsService.getChangesetById(csId, repo);
      if (res.success && res.changeset) {
        setInspectingChangeset(res.changeset);
      } else {
        setInspectingChangeset({
          changesetId: csId,
          repository: repo,
          branch: version?.uvcs?.branch || '/main',
          error: res.message || 'Extended UVCS log details unavailable'
        });
      }
    } catch (err) {
      setInspectingChangeset({
        changesetId: csId,
        error: err.message || 'Failed to communicate with UVCS service'
      });
    } finally {
      setIsLoadingChangeset(false);
    }
  };

  const handleOpenCreateBaselineModal = () => {
    setBaselineModalError('');
    setBaselineFormData({
      name: `Baseline v${version?.versionNumber} Milestone`,
      description: `Formal configuration baseline anchoring software version v${version?.versionNumber} to UVCS changeset cs:${version?.uvcs?.changesetId}.`
    });
    setShowCreateBaselineModal(true);
  };

  const handleCreateBaselineSubmit = async (e) => {
    e.preventDefault();
    setBaselineModalError('');

    if (!baselineFormData.name.trim()) {
      setBaselineModalError('Baseline name is required');
      return;
    }

    try {
      setIsCreatingBaseline(true);
      const res = await baselineService.createBaseline(projectId, {
        version: versionId,
        name: baselineFormData.name.trim(),
        description: baselineFormData.description.trim(),
        changesetId: version?.uvcs?.changesetId,
        branch: version?.uvcs?.branch || '/main',
        repository: version?.uvcs?.repository || 'default@local',
        status: 'active'
      });

      if (res.success) {
        setShowCreateBaselineModal(false);
        setSuccessMessage(`Configuration Baseline ${res.baseline.baselineId} created and locked to UVCS cs:${version?.uvcs?.changesetId}!`);
        setTimeout(() => setSuccessMessage(''), 5000);
        fetchVersionData();
      }
    } catch (err) {
      setBaselineModalError(err.message || 'Failed to create baseline');
    } finally {
      setIsCreatingBaseline(false);
    }
  };

  const handleFreezeBaselineFromVer = async (bl) => {
    if (!window.confirm(`Are you sure you want to freeze configuration baseline ${bl.baselineId} ('${bl.name}')? Once frozen, this configuration baseline cannot be altered.`)) {
      return;
    }

    try {
      const res = await baselineService.freezeBaseline(bl._id);
      if (res.success) {
        setSuccessMessage(`Configuration baseline ${bl.baselineId} is now frozen!`);
        setTimeout(() => setSuccessMessage(''), 4000);
        fetchVersionData();
      }
    } catch (err) {
      alert(`Failed to freeze baseline: ${err.message}`);
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

          {/* SOURCE CONTROL BASELINE Card */}
          <div className="card baseline-card" id="card-version-uvcs-baseline" style={{ borderTop: '4px solid #4f46e5' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: '800', letterSpacing: '0.08em', color: '#4f46e5', textTransform: 'uppercase' }}>
                  SOURCE CONTROL BASELINE
                </div>
                <h3 style={{ margin: '0.15rem 0 0 0', fontSize: '1.25rem' }}>
                  Unity Version Control Integration
                </h3>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="badge-source-uvcs" style={{ fontSize: '0.72rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#e0e7ff', color: '#3730a3', fontWeight: '700' }}>
                  SOURCE: UNITY VERSION CONTROL
                </span>
                {version.uvcs?.changesetId !== null && version.uvcs?.changesetId !== undefined ? (
                  <span className={`status-pill ${baselineDoc?.status === 'frozen' ? 'status-success' : 'status-published'}`} id="badge-uvcs-linked">
                    {baselineDoc?.status === 'frozen' ? '❄️ FROZEN' : (baselineDoc ? '● ACTIVE BASELINE' : `● Linked (cs:${version.uvcs.changesetId})`)}
                  </span>
                ) : (
                  <span className="status-pill status-deprecated" id="badge-uvcs-unlinked">
                    ○ Not Linked
                  </span>
                )}
              </div>
            </div>

            <div className="card-body">
              <div style={{ padding: '0.65rem 0.85rem', background: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#475569' }}>
                💡 <em>Unity Version Control manages source-code configuration and changesets. Smart SCM manages project, version, change, defect and release metadata.</em>
              </div>

              {version.uvcs?.changesetId !== null && version.uvcs?.changesetId !== undefined ? (
                <div className="baseline-content">
                  <div className="meta-list" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
                    <div className="meta-item-box" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Version:</span>
                      <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>v{version.versionNumber}</strong>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', marginLeft: '0.35rem' }}>({version.name})</span>
                    </div>

                    <div className="meta-item-box" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Repository:</span>
                      <code style={{ fontSize: '0.88rem', color: '#1e293b' }} id="version-uvcs-repo">
                        {baselineDoc?.repository || version.uvcs?.repository || 'default@local'}
                      </code>
                    </div>

                    <div className="meta-item-box" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Branch:</span>
                      <strong style={{ fontSize: '0.95rem', color: '#1e293b' }} id="version-uvcs-branch">
                        {baselineDoc?.branch || version.uvcs?.branch || '/main'}
                      </strong>
                    </div>

                    <div className="meta-item-box" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Changeset:</span>
                      <span className="status-pill status-in_progress" style={{ fontWeight: 700, fontSize: '0.9rem' }} id="version-uvcs-changeset">
                        cs:{version.uvcs.changesetId}
                      </span>
                    </div>

                    <div className="meta-item-box" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Changeset Author:</span>
                      <span style={{ fontSize: '0.9rem', fontWeight: '500' }}>
                        {baselineDoc?.changesetAuthor || csDetails?.owner || 'Local User'}
                      </span>
                    </div>

                    <div className="meta-item-box" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Changeset Date:</span>
                      <span style={{ fontSize: '0.82rem' }}>
                        {baselineDoc?.changesetDate || csDetails?.date || (baselineDoc ? new Date(baselineDoc.createdAt).toLocaleDateString() : 'Active')}
                      </span>
                    </div>

                    <div className="meta-item-box" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Workspace:</span>
                      <code style={{ fontSize: '0.85rem' }}>
                        {uvcsStatus?.workspace?.name || 'smart_scm_wk'}
                      </code>
                    </div>

                    <div className="meta-item-box" style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: '600', display: 'block' }}>Controlled Changes:</span>
                      <span style={{ fontSize: '0.88rem', fontWeight: '600', color: (uvcsStatus?.controlledChangesCount > 0 ? '#ea580c' : '#16a34a') }}>
                        {uvcsStatus?.controlledChangesCount !== undefined ? uvcsStatus.controlledChangesCount : 0} {uvcsStatus?.controlledChangesCount === 0 ? '(Clean)' : 'pending'}
                      </span>
                    </div>
                  </div>

                  {baselineDoc && (
                    <div style={{ padding: '0.75rem 1rem', background: '#ecfdf5', borderRadius: '6px', border: '1px solid #a7f3d0', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <strong>Configuration Baseline {baselineDoc.baselineId}:</strong> {baselineDoc.name} &bull; <span style={{ textTransform: 'uppercase', fontSize: '0.78rem', fontWeight: '700' }}>Status: {baselineDoc.status}</span>
                      </div>
                      <Link to="/baselines" style={{ fontSize: '0.82rem', fontWeight: '600', textDecoration: 'none' }}>
                        View in Baselines Registry &rarr;
                      </Link>
                    </div>
                  )}

                  {/* Actions row */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center', borderTop: '1px solid #e2e8f0', paddingTop: '1rem' }}>
                    <button
                      type="button"
                      onClick={() => handleViewChangeset(version.uvcs.changesetId)}
                      className="btn-secondary-small"
                      id="btn-view-changeset"
                    >
                      🔍 View Changeset
                    </button>

                    <button
                      type="button"
                      onClick={() => setShowBranchModal(true)}
                      className="btn-secondary-small"
                      id="btn-view-branch"
                    >
                      🌿 View Branch
                    </button>

                    {canManage && !baselineDoc && (
                      <button
                        type="button"
                        onClick={handleOpenCreateBaselineModal}
                        className="btn-primary-small"
                        id="btn-create-baseline-from-ver"
                        style={{ background: '#4f46e5' }}
                      >
                        🏷️ Create Baseline
                      </button>
                    )}

                    {canManage && baselineDoc && baselineDoc.status !== 'frozen' && (
                      <button
                        type="button"
                        onClick={() => handleFreezeBaselineFromVer(baselineDoc)}
                        className="btn-primary-small"
                        id="btn-freeze-baseline-from-ver"
                        style={{ background: '#0284c7' }}
                      >
                        ❄️ Freeze Baseline
                      </button>
                    )}

                    {canManage && (
                      <button
                        type="button"
                        onClick={handleOpenUvcsModal}
                        className="btn-action-primary-small"
                        id="btn-change-version-uvcs"
                      >
                        🔗 Change Baseline
                      </button>
                    )}

                    {canManage && (
                      <button
                        type="button"
                        onClick={handleUnlinkUvcs}
                        className="btn-danger-outline"
                        style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem' }}
                        id="btn-unlink-version-uvcs"
                      >
                        Unlink
                      </button>
                    )}
                  </div>
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

        {/* View UVCS Changeset Modal */}
        {showChangesetModal && inspectingChangeset && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>UVCS Changeset Inspector</h3>
                <button
                  onClick={() => setShowChangesetModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              <div className="modal-body" style={{ padding: '1.5rem' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="status-pill status-in_progress" style={{ fontSize: '1rem', fontWeight: 700 }}>
                    cs:{inspectingChangeset.changesetId}
                  </span>
                  <span className="badge-source-uvcs" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#e0e7ff', color: '#3730a3', fontWeight: '700' }}>
                    SOURCE: UNITY VERSION CONTROL
                  </span>
                </div>

                {isLoadingChangeset ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="spinner"></div>
                    <p>Querying Unity Version Control metadata...</p>
                  </div>
                ) : (
                  <div className="meta-list" style={{ fontSize: '0.9rem' }}>
                    <div className="meta-row">
                      <span className="meta-label">Branch:</span>
                      <span className="meta-value"><strong>{inspectingChangeset.branch || version?.uvcs?.branch || '/main'}</strong></span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Author:</span>
                      <span className="meta-value">{inspectingChangeset.owner || csDetails?.owner || 'Local User'}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Date:</span>
                      <span className="meta-value">{inspectingChangeset.date || csDetails?.date || 'Initial Milestone'}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Repository:</span>
                      <span className="meta-value"><code>{version?.uvcs?.repository || 'default@local'}</code></span>
                    </div>
                    {inspectingChangeset.guid && (
                      <div className="meta-row">
                        <span className="meta-label">GUID:</span>
                        <span className="meta-value"><code style={{ fontSize: '0.75rem' }}>{inspectingChangeset.guid}</code></span>
                      </div>
                    )}
                    <div className="meta-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <span className="meta-label">Commit Comment:</span>
                      <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', width: '100%', fontSize: '0.85rem', border: '1px solid var(--border-color)', color: inspectingChangeset.comment ? '#1e293b' : '#64748b', fontStyle: inspectingChangeset.comment ? 'normal' : 'italic' }}>
                        {inspectingChangeset.comment || 'Root repository commit / No comment recorded'}
                      </div>
                    </div>
                  </div>
                )}

                <div className="modal-actions" style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setShowChangesetModal(false)}
                    className="btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* View UVCS Branch Modal */}
        {showBranchModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>UVCS Branch Configuration</h3>
                <button
                  onClick={() => setShowBranchModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              <div className="modal-body" style={{ padding: '1.5rem' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <strong style={{ fontSize: '1.1rem', color: '#1e293b' }}>
                    🌿 {version?.uvcs?.branch || '/main'}
                  </strong>
                  <span className="badge-source-uvcs" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', background: '#e0e7ff', color: '#3730a3', fontWeight: '700' }}>
                    SOURCE: UNITY VERSION CONTROL
                  </span>
                </div>

                <div className="meta-list" style={{ fontSize: '0.9rem' }}>
                  <div className="meta-row">
                    <span className="meta-label">Repository:</span>
                    <span className="meta-value"><code>{version?.uvcs?.repository || 'default@local'}</code></span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Head Changeset:</span>
                    <span className="meta-value"><span className="status-pill status-in_progress">cs:{version?.uvcs?.changesetId !== undefined ? version?.uvcs?.changesetId : 0}</span></span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Local Workspace:</span>
                    <span className="meta-value"><code>{uvcsStatus?.workspace?.name || 'smart_scm_wk'}</code></span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Branch Status:</span>
                    <span className="meta-value"><span className="status-pill status-active">Active Source Branch</span></span>
                  </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => setShowBranchModal(false)}
                    className="btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Create Baseline from Version Modal */}
        {showCreateBaselineModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Create Configuration Baseline</h3>
                <button
                  onClick={() => setShowCreateBaselineModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {baselineModalError && (
                <div className="alert alert-danger" style={{ margin: '1rem 1.5rem 0 1.5rem' }}>
                  <span>⚠️ {baselineModalError}</span>
                </div>
              )}

              <form onSubmit={handleCreateBaselineSubmit} className="modal-form" style={{ padding: '1.5rem' }}>
                <p style={{ margin: '0 0 1rem 0', fontSize: '0.88rem', color: '#475569' }}>
                  Anchor software version <strong>v{version?.versionNumber}</strong> to a formal Configuration Baseline registered at UVCS changeset <strong>cs:{version?.uvcs?.changesetId}</strong>.
                </p>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="ver-baseline-name">Baseline Name *</label>
                  <input
                    id="ver-baseline-name"
                    type="text"
                    className="form-input"
                    value={baselineFormData.name}
                    onChange={(e) => setBaselineFormData({ ...baselineFormData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="ver-baseline-description">Description</label>
                  <textarea
                    id="ver-baseline-description"
                    className="form-input"
                    rows={2}
                    value={baselineFormData.description}
                    onChange={(e) => setBaselineFormData({ ...baselineFormData, description: e.target.value })}
                  />
                </div>

                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateBaselineModal(false)}
                    className="btn-secondary"
                    disabled={isCreatingBaseline}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-action-primary"
                    disabled={isCreatingBaseline}
                    id="btn-submit-create-ver-baseline"
                  >
                    {isCreatingBaseline ? 'Creating...' : 'Create & Anchor Baseline'}
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
