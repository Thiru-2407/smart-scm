import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { baselineService, projectService, versionService, uvcsService } from '../services/api';

const statusBadgeColors = {
  draft: 'status-pending',
  active: 'status-active',
  frozen: 'status-success',
  superseded: 'status-inactive'
};

const Baselines = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get('project') || '';
  const initialStatus = searchParams.get('status') || '';

  const { user } = useAuth();

  const [baselines, setBaselines] = useState([]);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);
  const [selectedStatus, setSelectedStatus] = useState(initialStatus);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({
    totalBaselines: 0,
    activeBaselines: 0,
    frozenBaselines: 0,
    draftBaselines: 0,
    supersededBaselines: 0
  });

  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Modals state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showChangesetModal, setShowChangesetModal] = useState(false);
  const [inspectingChangeset, setInspectingChangeset] = useState(null);
  const [isLoadingChangeset, setIsLoadingChangeset] = useState(false);

  // Create form state
  const [createFormData, setCreateFormData] = useState({
    projectId: '',
    versionId: '',
    name: '',
    description: '',
    changesetId: '',
    branch: '/main',
    repository: 'default@local',
    status: 'active'
  });
  const [projectVersions, setProjectVersions] = useState([]);
  const [uvcsChangesets, setUvcsChangesets] = useState([]);
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  const fetchInitialData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const [projsRes, statsRes] = await Promise.all([
        projectService.getProjects(),
        baselineService.getStats().catch(() => ({ success: false }))
      ]);

      if (projsRes.success) {
        setProjects(projsRes.projects || []);
      }

      if (statsRes.success && statsRes.stats) {
        setStats(statsRes.stats);
      }

      await loadBaselines(selectedProjectId, selectedStatus, searchQuery);
    } catch (err) {
      setErrorMessage(err.message || 'Failed to load configuration baselines');
    } finally {
      setIsLoading(false);
    }
  };

  const loadBaselines = async (projectId = '', status = '', search = '') => {
    try {
      const params = {};
      if (projectId) params.project = projectId;
      if (status) params.status = status;
      if (search) params.search = search;

      const res = await baselineService.getBaselines(params);
      if (res.success) {
        setBaselines(res.baselines || []);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Failed to fetch baselines');
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  const handleFilterChange = (projId, status, search) => {
    setSelectedProjectId(projId);
    setSelectedStatus(status);
    setSearchQuery(search);

    const newParams = new URLSearchParams();
    if (projId) newParams.set('project', projId);
    if (status) newParams.set('status', status);
    setSearchParams(newParams);

    loadBaselines(projId, status, search);
  };

  // Open Create Modal
  const handleOpenCreateModal = async () => {
    setCreateError('');
    const defaultProjId = selectedProjectId || (projects.length > 0 ? projects[0]._id : '');
    setCreateFormData({
      projectId: defaultProjId,
      versionId: '',
      name: '',
      description: '',
      changesetId: '',
      branch: '/main',
      repository: 'default@local',
      status: 'active'
    });

    if (defaultProjId) {
      await loadVersionsForProject(defaultProjId);
    }

    // Try loading live UVCS changesets
    try {
      const csRes = await uvcsService.getChangesets();
      if (csRes.success && csRes.changesets) {
        setUvcsChangesets(csRes.changesets);
        if (csRes.changesets.length > 0) {
          setCreateFormData(prev => ({
            ...prev,
            changesetId: csRes.changesets[0].changesetId,
            branch: csRes.changesets[0].branch || '/main',
            repository: csRes.changesets[0].repository ? `${csRes.changesets[0].repository}@${csRes.changesets[0].server || 'local'}` : 'default@local'
          }));
        }
      }
    } catch {
      // CLI may be unavailable in cloud, user can enter numeric changeset ID
    }

    setShowCreateModal(true);
  };

  const loadVersionsForProject = async (projId) => {
    try {
      const verRes = await versionService.getVersions(projId);
      if (verRes.success) {
        setProjectVersions(verRes.versions || []);
        if (verRes.versions && verRes.versions.length > 0) {
          setCreateFormData(prev => ({ ...prev, versionId: verRes.versions[0]._id }));
        }
      }
    } catch {
      setProjectVersions([]);
    }
  };

  const handleProjectSelectInCreate = async (projId) => {
    setCreateFormData(prev => ({ ...prev, projectId: projId, versionId: '' }));
    if (projId) {
      await loadVersionsForProject(projId);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setCreateError('');

    if (!createFormData.projectId) {
      setCreateError('Please select a project');
      return;
    }
    if (!createFormData.versionId) {
      setCreateError('Please select a software version to anchor this baseline');
      return;
    }
    if (!createFormData.name.trim()) {
      setCreateError('Please enter a baseline name');
      return;
    }
    if (createFormData.changesetId === '' || isNaN(parseInt(createFormData.changesetId, 10))) {
      setCreateError('Please enter or select a valid numeric UVCS changeset ID');
      return;
    }

    try {
      setIsCreating(true);
      const res = await baselineService.createBaseline(createFormData.projectId, {
        name: createFormData.name.trim(),
        description: createFormData.description.trim(),
        version: createFormData.versionId,
        changesetId: parseInt(createFormData.changesetId, 10),
        branch: createFormData.branch,
        repository: createFormData.repository,
        status: createFormData.status
      });

      if (res.success) {
        setShowCreateModal(false);
        setSuccessMessage(`Baseline ${res.baseline.baselineId} created and anchored to UVCS cs:${res.baseline.changesetId}!`);
        setTimeout(() => setSuccessMessage(''), 5000);
        await loadBaselines(selectedProjectId, selectedStatus, searchQuery);
        const statsRes = await baselineService.getStats().catch(() => ({ success: false }));
        if (statsRes.success) setStats(statsRes.stats);
      }
    } catch (err) {
      setCreateError(err.message || 'Failed to create configuration baseline');
    } finally {
      setIsCreating(false);
    }
  };

  // Freeze Baseline Action
  const handleFreezeBaseline = async (baseline) => {
    if (!window.confirm(`Are you sure you want to freeze baseline ${baseline.baselineId} ('${baseline.name}')? Once frozen, this configuration is permanently locked for release verification.`)) {
      return;
    }

    try {
      const res = await baselineService.freezeBaseline(baseline._id);
      if (res.success) {
        setSuccessMessage(`Configuration baseline ${baseline.baselineId} has been successfully frozen!`);
        setTimeout(() => setSuccessMessage(''), 4000);
        await loadBaselines(selectedProjectId, selectedStatus, searchQuery);
        const statsRes = await baselineService.getStats().catch(() => ({ success: false }));
        if (statsRes.success) setStats(statsRes.stats);
      }
    } catch (err) {
      alert(`Failed to freeze baseline: ${err.message}`);
    }
  };

  // View UVCS Changeset Details Modal
  const handleInspectChangeset = async (changesetId, repository) => {
    try {
      setIsLoadingChangeset(true);
      setShowChangesetModal(true);
      setInspectingChangeset({ changesetId, repository, loading: true });

      const res = await uvcsService.getChangesetById(changesetId, repository);
      if (res.success && res.changeset) {
        setInspectingChangeset(res.changeset);
      } else {
        setInspectingChangeset({
          changesetId,
          repository,
          error: res.message || 'UVCS CLI is unavailable in this environment to retrieve extended log metadata.'
        });
      }
    } catch (err) {
      setInspectingChangeset({
        changesetId,
        repository,
        error: err.message || 'Error communicating with Unity Version Control'
      });
    } finally {
      setIsLoadingChangeset(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="main-content" id="baselines-page">
        {/* Page Header */}
        <div className="page-header" style={{ marginBottom: '1.25rem' }}>
          <div>
            <div className="traceability-eyebrow">
              CONFIGURATION MANAGEMENT • SOURCE-CONTROL BASELINES
            </div>
            <h1 id="baselines-page-title" style={{ fontSize: '1.85rem', fontWeight: '700', margin: '0.2rem 0' }}>
              Configuration Baselines
            </h1>
            <p className="page-subtitle" style={{ margin: 0, color: 'var(--text-muted)' }}>
              Anchor software versions to verified UVCS changesets.
            </p>
          </div>

          <div className="header-actions">
            <button
              onClick={handleOpenCreateModal}
              className="btn-action-primary"
              id="btn-create-baseline"
            >
              + Create Baseline
            </button>
          </div>
        </div>


        {/* Success / Error Alerts */}
        {successMessage && (
          <div className="alert alert-success" style={{ marginBottom: '1.25rem' }}>
            <span>✅ {successMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="alert alert-danger" style={{ marginBottom: '1.25rem' }}>
            <span>⚠️ {errorMessage}</span>
          </div>
        )}

        {/* Overview Stat Cards */}
        <div className="stats-grid stats-grid-4" style={{ marginBottom: '1.75rem' }}>
          <div className="stat-card" id="stat-total-baselines">
            <div className="stat-icon-wrapper blue">📦</div>
            <div className="stat-content">
              <span className="stat-label">Total Baselines</span>
              <span className="stat-value">{stats.totalBaselines}</span>
              <span className="stat-subtext">All projects</span>
            </div>
          </div>

          <div className="stat-card" id="stat-active-baselines">
            <div className="stat-icon-wrapper amber">🟢</div>
            <div className="stat-content">
              <span className="stat-label">Active Baselines</span>
              <span className="stat-value">{stats.activeBaselines}</span>
              <span className="stat-subtext">Live</span>
            </div>
          </div>

          <div className="stat-card" id="stat-frozen-baselines">
            <div className="stat-icon-wrapper green">❄️</div>
            <div className="stat-content">
              <span className="stat-label">Frozen Baselines</span>
              <span className="stat-value">{stats.frozenBaselines}</span>
              <span className="stat-subtext">Release-locked</span>
            </div>
          </div>

          <div className="stat-card" id="stat-uvcs-linked">
            <div className="stat-icon-wrapper indigo">🔗</div>
            <div className="stat-content">
              <span className="stat-label">UVCS Verified</span>
              <span className="stat-value">{stats.totalBaselines}</span>
              <span className="stat-subtext">100% verified</span>
            </div>
          </div>
        </div>

        {/* Filter Controls Card */}
        <section className="card filter-bar-card" style={{ marginBottom: '1.75rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            <div>
              <label htmlFor="filter-baseline-project" style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                Filter by Project
              </label>
              <select
                id="filter-baseline-project"
                className="form-select"
                value={selectedProjectId}
                onChange={(e) => handleFilterChange(e.target.value, selectedStatus, searchQuery)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              >
                <option value="">All Accessible Projects</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    [{p.key}] {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="filter-baseline-status" style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                Filter by Status
              </label>
              <select
                id="filter-baseline-status"
                className="form-select"
                value={selectedStatus}
                onChange={(e) => handleFilterChange(selectedProjectId, e.target.value, searchQuery)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              >
                <option value="">All Statuses</option>
                <option value="active">Active</option>
                <option value="frozen">Frozen</option>
                <option value="draft">Draft</option>
                <option value="superseded">Superseded</option>
              </select>
            </div>

            <div>
              <label htmlFor="filter-baseline-search" style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                Search Baselines
              </label>
              <input
                id="filter-baseline-search"
                type="text"
                placeholder="Search by ID, name, branch..."
                value={searchQuery}
                onChange={(e) => handleFilterChange(selectedProjectId, selectedStatus, e.target.value)}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              />
            </div>

            <div>
              <button
                type="button"
                onClick={() => handleFilterChange('', '', '')}
                className="btn-secondary"
                style={{ width: '100%', height: '38px' }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        </section>

        {/* Baselines Table / Grid */}
        <section className="card" id="baselines-table-card">
          <div className="card-header">
            <h3>Configuration Baselines ({baselines.length})</h3>
          </div>

          <div className="card-body" style={{ padding: 0 }}>
            {isLoading ? (
              <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                <div className="spinner" style={{ marginBottom: '0.75rem' }}></div>
                Loading configuration baselines...
              </div>
            ) : baselines.length === 0 ? (
              <div style={{ padding: '3.5rem', textAlign: 'center' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>📦</div>
                <h4 style={{ margin: '0 0 0.5rem 0' }}>No Configuration Baselines Found</h4>
                <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 1.25rem auto' }}>
                  No baselines match the current filters.
                </p>
                <button onClick={handleOpenCreateModal} className="btn-action-primary">
                  + Create First Baseline
                </button>
              </div>
            ) : (
              <div className="table-responsive">
                <table className="data-table" id="baselines-table">
                  <thead>
                    <tr>
                      <th>Baseline ID</th>
                      <th>Baseline Name</th>
                      <th>Project</th>
                      <th>Software Version</th>
                      <th>UVCS Source Baseline</th>
                      <th>Status</th>
                      <th>Created</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {baselines.map((bl) => {
                      const isOwnerOrAdmin = user && (user.role === 'admin' || bl.project?.owner?._id === user.id || bl.project?.owner === user.id);

                      return (
                        <tr key={bl._id} className="baseline-row" id={`baseline-row-${bl.baselineId}`}>
                          <td>
                            <strong style={{ fontFamily: 'monospace', color: 'var(--primary)', fontSize: '0.95rem' }}>
                              {bl.baselineId}
                            </strong>
                          </td>
                          <td>
                            <div>
                              <strong>{bl.name}</strong>
                              {bl.description && (
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                  {bl.description}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <Link to={`/projects/${bl.project?._id}`} style={{ textDecoration: 'none', fontWeight: '500' }}>
                              [{bl.project?.key}] {bl.project?.name}
                            </Link>
                          </td>
                          <td>
                            <Link to={`/projects/${bl.project?._id}/versions/${bl.version?._id}`} style={{ textDecoration: 'none' }}>
                              <span className="status-pill status-active" style={{ fontSize: '0.8rem' }}>
                                v{bl.version?.versionNumber}
                              </span>
                            </Link>
                          </td>
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                                <span className="status-pill status-in_progress" style={{ fontWeight: '700', fontSize: '0.78rem' }}>
                                  cs:{bl.changesetId}
                                </span>
                                <span style={{ fontSize: '0.85rem', fontWeight: '600' }}>{bl.branch}</span>
                              </div>
                              <code style={{ fontSize: '0.72rem', color: '#64748b' }}>{bl.repository}</code>
                            </div>
                          </td>
                          <td>
                            <span className={`status-pill ${statusBadgeColors[bl.status] || 'status-pending'}`}>
                              {bl.status === 'frozen' ? '❄️ Frozen' : bl.status.toUpperCase()}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                            <div>{new Date(bl.createdAt).toLocaleDateString()}</div>
                            <div style={{ fontSize: '0.75rem' }}>by {bl.createdBy?.name || 'User'}</div>
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <div style={{ display: 'inline-flex', gap: '0.4rem', justifyContent: 'flex-end' }}>
                              <button
                                type="button"
                                onClick={() => handleInspectChangeset(bl.changesetId, bl.repository)}
                                className="btn-secondary-small"
                                title="Inspect live UVCS changeset metadata"
                                style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem' }}
                              >
                                🔍 Inspect
                              </button>

                              {isOwnerOrAdmin && bl.status !== 'frozen' && (
                                <button
                                  type="button"
                                  onClick={() => handleFreezeBaseline(bl)}
                                  className="btn-primary-small"
                                  title="Freeze baseline (lock configuration)"
                                  style={{ fontSize: '0.78rem', padding: '0.25rem 0.5rem', background: '#0284c7' }}
                                >
                                  ❄️ Freeze
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

        {/* Create Baseline Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <div className="modal-card modal-large">
              <div className="modal-header">
                <h3>Create Configuration Baseline</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {createError && (
                <div className="alert alert-danger" style={{ margin: '1rem 1.5rem 0 1.5rem' }}>
                  <span>⚠️ {createError}</span>
                </div>
              )}

              <form onSubmit={handleCreateSubmit} className="modal-form" style={{ padding: '1.5rem' }}>
                <div className="form-row-2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                  <div className="form-group">
                    <label htmlFor="create-baseline-project">Project *</label>
                    <select
                      id="create-baseline-project"
                      className="form-select"
                      value={createFormData.projectId}
                      onChange={(e) => handleProjectSelectInCreate(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Project --</option>
                      {projects.map((p) => (
                        <option key={p._id} value={p._id}>
                          [{p.key}] {p.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="create-baseline-version">Software Version *</label>
                    <select
                      id="create-baseline-version"
                      className="form-select"
                      value={createFormData.versionId}
                      onChange={(e) => setCreateFormData({ ...createFormData, versionId: e.target.value })}
                      disabled={projectVersions.length === 0}
                      required
                    >
                      {projectVersions.length === 0 ? (
                        <option value="">No versions in selected project</option>
                      ) : (
                        <>
                          <option value="">-- Select Version --</option>
                          {projectVersions.map((v) => (
                            <option key={v._id} value={v._id}>
                              v{v.versionNumber} &mdash; {v.name} ({v.status})
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="create-baseline-name">Baseline Title *</label>
                  <input
                    id="create-baseline-name"
                    type="text"
                    className="form-input"
                    placeholder="e.g. Release 1.0.0 Candidate Baseline"
                    value={createFormData.name}
                    onChange={(e) => setCreateFormData({ ...createFormData, name: e.target.value })}
                    required
                  />
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label htmlFor="create-baseline-description">Description & Scope</label>
                  <textarea
                    id="create-baseline-description"
                    className="form-input"
                    rows={2}
                    placeholder="Purpose of this configuration baseline..."
                    value={createFormData.description}
                    onChange={(e) => setCreateFormData({ ...createFormData, description: e.target.value })}
                  />
                </div>

                {/* UVCS Source Control Baseline Verification Box */}
                <div style={{ background: '#f8fafc', border: '1.5px solid #cbd5e1', borderRadius: '8px', padding: '1rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <div style={{ fontWeight: '700', fontSize: '0.9rem', color: '#1e293b' }}>
                      🔗 Unity Version Control Verification
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#4338ca' }}>
                      SOURCE: UNITY VERSION CONTROL
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label htmlFor="create-baseline-changeset" style={{ fontSize: '0.8rem' }}>UVCS Changeset ID *</label>
                      {uvcsChangesets.length > 0 ? (
                        <select
                          id="create-baseline-changeset"
                          className="form-select"
                          value={createFormData.changesetId}
                          onChange={(e) => {
                            const csVal = e.target.value;
                            const found = uvcsChangesets.find(c => String(c.changesetId) === String(csVal));
                            setCreateFormData({
                              ...createFormData,
                              changesetId: csVal,
                              branch: found ? (found.branch || '/main') : createFormData.branch
                            });
                          }}
                          required
                        >
                          {uvcsChangesets.map((cs) => (
                            <option key={cs.changesetId} value={cs.changesetId}>
                              cs:{cs.changesetId} &bull; {cs.branch} ({cs.owner || 'author'})
                            </option>
                          ))}
                        </select>
                      ) : (
                        <input
                          id="create-baseline-changeset"
                          type="number"
                          className="form-input"
                          placeholder="e.g. 0"
                          value={createFormData.changesetId}
                          onChange={(e) => setCreateFormData({ ...createFormData, changesetId: e.target.value })}
                          required
                        />
                      )}
                    </div>

                    <div className="form-group">
                      <label htmlFor="create-baseline-branch" style={{ fontSize: '0.8rem' }}>Branch</label>
                      <input
                        id="create-baseline-branch"
                        type="text"
                        className="form-input"
                        value={createFormData.branch}
                        onChange={(e) => setCreateFormData({ ...createFormData, branch: e.target.value })}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="create-baseline-repo" style={{ fontSize: '0.8rem' }}>Repository</label>
                      <input
                        id="create-baseline-repo"
                        type="text"
                        className="form-input"
                        value={createFormData.repository}
                        onChange={(e) => setCreateFormData({ ...createFormData, repository: e.target.value })}
                      />
                    </div>
                  </div>

                </div>

                <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-action-primary"
                    disabled={isCreating}
                    id="btn-submit-create-baseline"
                  >
                    {isCreating ? 'Validating with UVCS...' : 'Create & Verify Baseline'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Inspect Changeset Modal */}
        {showChangesetModal && inspectingChangeset && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Unity Version Control Changeset Details</h3>
                <button
                  onClick={() => {
                    setShowChangesetModal(false);
                    setInspectingChangeset(null);
                  }}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              <div className="modal-body" style={{ padding: '1.5rem' }}>
                <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className="status-pill status-in_progress" style={{ fontSize: '1rem', fontWeight: '700' }}>
                    cs:{inspectingChangeset.changesetId}
                  </span>
                </div>

                {isLoadingChangeset ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="spinner"></div>
                    <p>Querying Unity Version Control metadata...</p>
                  </div>
                ) : inspectingChangeset.error ? (
                  <div className="alert alert-warning">
                    <span>ℹ️ {inspectingChangeset.error}</span>
                  </div>
                ) : (
                  <div className="meta-list" style={{ fontSize: '0.9rem' }}>
                    <div className="meta-row">
                      <span className="meta-label">Branch:</span>
                      <span className="meta-value"><strong>{inspectingChangeset.branch || '/main'}</strong></span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Author:</span>
                      <span className="meta-value">{inspectingChangeset.owner || 'Local User'}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Commit Date:</span>
                      <span className="meta-value">{inspectingChangeset.date || 'Initial Commit'}</span>
                    </div>
                    <div className="meta-row">
                      <span className="meta-label">Repository:</span>
                      <span className="meta-value"><code>{inspectingChangeset.repository || 'default'}@{inspectingChangeset.server || 'local'}</code></span>
                    </div>
                    {inspectingChangeset.guid && (
                      <div className="meta-row">
                        <span className="meta-label">GUID:</span>
                        <span className="meta-value"><code style={{ fontSize: '0.75rem' }}>{inspectingChangeset.guid}</code></span>
                      </div>
                    )}
                    <div className="meta-row" style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '0.35rem', marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-color)' }}>
                      <span className="meta-label">Commit Comment:</span>
                      <div style={{ background: '#f8fafc', padding: '0.75rem', borderRadius: '6px', width: '100%', fontSize: '0.85rem', border: '1px solid var(--border-color)', fontStyle: inspectingChangeset.comment ? 'normal' : 'italic', color: inspectingChangeset.comment ? '#1e293b' : '#64748b' }}>
                        {inspectingChangeset.comment || 'No comment recorded for root changeset'}
                      </div>
                    </div>
                  </div>
                )}

                <div className="modal-actions" style={{ marginTop: '1.5rem', textAlign: 'right' }}>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChangesetModal(false);
                      setInspectingChangeset(null);
                    }}
                    className="btn-secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Baselines;
