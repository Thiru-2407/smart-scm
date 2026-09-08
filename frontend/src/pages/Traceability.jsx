import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { traceabilityService, projectService } from '../services/api';

const statusBadgeColors = {
  // CR statuses
  submitted: 'status-pending',
  under_review: 'status-warning',
  approved: 'status-active',
  rejected: 'status-withdrawn',
  implemented: 'status-active',
  cancelled: 'status-withdrawn',
  // Bug statuses
  open: 'status-danger',
  in_progress: 'status-warning',
  resolved: 'status-active',
  closed: 'status-info',
  reopened: 'status-danger',
  // Version statuses
  development: 'status-info',
  testing: 'status-warning',
  released: 'status-active',
  deprecated: 'status-withdrawn',
  // Release statuses
  draft: 'status-pending',
  pending_approval: 'status-warning',
  published: 'status-active',
  withdrawn: 'status-withdrawn'
};

const Traceability = () => {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const initialRelease = searchParams.get('release') || '';

  const [traceabilityData, setTraceabilityData] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedVersion, setSelectedVersion] = useState('');
  const [selectedRelease, setSelectedRelease] = useState(initialRelease);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedRowIndex, setSelectedRowIndex] = useState(0);

  useEffect(() => {
    const rel = searchParams.get('release');
    if (rel) {
      setSelectedRelease(rel);
    }
  }, [searchParams]);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Link Modal State
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [linkingProject, setLinkingProject] = useState('');
  const [linkCRId, setLinkCRId] = useState('');
  const [linkBugId, setLinkBugId] = useState('');
  const [linkVersionId, setLinkVersionId] = useState('');
  const [linkReleaseId, setLinkReleaseId] = useState('');
  const [isSubmittingLink, setIsSubmittingLink] = useState(false);
  const [linkError, setLinkError] = useState('');

  // Fetch available projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await projectService.getProjects();
        if (res.success && res.projects) {
          setProjects(res.projects);
          if (res.projects.length > 0 && !selectedProject) {
            // Default to Smart SCM if available, else first project
            const smartScm = res.projects.find((p) => p.key === 'SMART-SCM');
            setSelectedProject(smartScm ? smartScm._id : res.projects[0]._id);
          }
        }
      } catch (err) {
        console.error('Failed to fetch projects:', err);
      }
    };
    fetchProjects();
  }, []);

  // Fetch traceability data when filters change
  const fetchTraceability = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const params = {};
      if (selectedProject) params.project = selectedProject;
      if (selectedVersion) params.version = selectedVersion;
      if (selectedRelease) params.release = selectedRelease;
      if (selectedStatus) params.status = selectedStatus;

      const res = await traceabilityService.getTraceability(params);
      if (res.success && res.data) {
        setTraceabilityData(res.data);
        setSelectedRowIndex(0);
      } else {
        setError(res.message || 'Failed to load traceability matrix');
      }
    } catch (err) {
      console.error('Error fetching traceability:', err);
      setError(err.message || 'Error connecting to traceability API');
    } finally {
      setIsLoading(false);
    }
  }, [selectedProject, selectedVersion, selectedRelease, selectedStatus]);

  useEffect(() => {
    fetchTraceability();
  }, [fetchTraceability]);

  const handleResetFilters = () => {
    setSelectedVersion('');
    setSelectedRelease('');
    setSelectedStatus('');
    // keep selected project or revert to first
    if (projects.length > 0) {
      const smartScm = projects.find((p) => p.key === 'SMART-SCM');
      setSelectedProject(smartScm ? smartScm._id : projects[0]._id);
    } else {
      setSelectedProject('');
    }
  };

  const handleOpenLinkModal = () => {
    setLinkingProject(selectedProject || (projects.length > 0 ? projects[0]._id : ''));
    setLinkCRId('');
    setLinkBugId('');
    setLinkVersionId('');
    setLinkReleaseId('');
    setLinkError('');
    setShowLinkModal(true);
  };

  const handleCreateLink = async (e) => {
    e.preventDefault();
    if (!linkingProject) {
      setLinkError('Please select a project');
      return;
    }
    if (!linkCRId && !linkBugId && !linkVersionId && !linkReleaseId) {
      setLinkError('Please select at least two artifacts to link together');
      return;
    }

    setIsSubmittingLink(true);
    setLinkError('');
    try {
      const payload = {
        projectId: linkingProject,
        changeRequestId: linkCRId || undefined,
        bugId: linkBugId || undefined,
        versionId: linkVersionId || undefined,
        releaseId: linkReleaseId || undefined
      };
      const res = await traceabilityService.linkArtifacts(payload);
      if (res.success) {
        setSuccessMessage('Traceability relationship successfully linked and logged to audit trail!');
        setShowLinkModal(false);
        fetchTraceability();
        setTimeout(() => setSuccessMessage(''), 4000);
      } else {
        setLinkError(res.message || 'Failed to create traceability link');
      }
    } catch (err) {
      setLinkError(err.message || 'Server error establishing traceability link');
    } finally {
      setIsSubmittingLink(false);
    }
  };

  const summary = traceabilityData?.summary || {
    totalChangeRequests: 0,
    linkedChangeRequests: 0,
    totalBugs: 0,
    linkedBugs: 0,
    totalVersions: 0,
    linkedVersions: 0,
    totalReleases: 0,
    linkedReleases: 0,
    uvcsLinkedVersions: 0,
    uvcsLinkedReleases: 0,
    coveragePercentage: 0,
    crCoverage: 0,
    bugCoverage: 0,
    versionCoverage: 0,
    releaseCoverage: 0,
    uvcsCoverage: 0
  };

  const rows = traceabilityData?.rows || [];
  const filtersMeta = traceabilityData?.filters || { projects: [], versions: [], releases: [] };
  const activeRow = rows.length > 0 ? rows[Math.min(selectedRowIndex, rows.length - 1)] : null;

  return (
    <div className="app-container">
      <Navbar />

      <main className="main-content" style={{ paddingBottom: '3rem' }}>
        {/* Header Banner */}
        <div className="traceability-header-row" style={{ marginBottom: '1.75rem' }}>
          <div>
            <div className="traceability-eyebrow">
              CONFIGURATION MANAGEMENT • SCM TRACEABILITY MATRIX
            </div>
            <h1 id="traceability-page-title" style={{ fontSize: '1.85rem', fontWeight: '700', margin: '0.2rem 0' }}>
              Traceability Matrix
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
              Track configuration changes from request through bug, version, source-control baseline, and release.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            <button
              onClick={handleOpenLinkModal}
              className="btn btn-primary"
              id="btn-link-artifacts"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <span>🔗</span>
              <span>Link Artifacts</span>
            </button>
          </div>
        </div>

        {/* Success Alert */}
        {successMessage && (
          <div className="alert alert-success" style={{ marginBottom: '1.5rem' }}>
            {successMessage}
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            {error}
          </div>
        )}

        {/* Step 7: Summary Cards */}
        <section className="stats-section" style={{ marginBottom: '2rem' }}>
          <div className="stats-grid stats-grid-4">
            <div className="stat-card" id="stat-trace-crs">
              <div className="stat-icon-wrapper purple">📝</div>
              <div className="stat-content">
                <span className="stat-label">Change Requests</span>
                <span className="stat-value">
                  {isLoading ? '...' : summary.totalChangeRequests}
                </span>
                <span className="stat-subtext" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {isLoading ? '...' : `${summary.linkedChangeRequests} Linked (${summary.crCoverage}%)`}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-trace-bugs">
              <div className="stat-icon-wrapper red">🐛</div>
              <div className="stat-content">
                <span className="stat-label">Defects / Bugs</span>
                <span className="stat-value">
                  {isLoading ? '...' : summary.totalBugs}
                </span>
                <span className="stat-subtext" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {isLoading ? '...' : `${summary.linkedBugs} Linked (${summary.bugCoverage}%)`}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-trace-versions">
              <div className="stat-icon-wrapper blue">🏷️</div>
              <div className="stat-content">
                <span className="stat-label">Software Versions</span>
                <span className="stat-value">
                  {isLoading ? '...' : summary.totalVersions}
                </span>
                <span className="stat-subtext" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {isLoading ? '...' : `${summary.linkedVersions} Linked (${summary.versionCoverage}%)`}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-trace-releases">
              <div className="stat-icon-wrapper green">🚀</div>
              <div className="stat-content">
                <span className="stat-label">Releases</span>
                <span className="stat-value">
                  {isLoading ? '...' : summary.totalReleases}
                </span>
                <span className="stat-subtext" style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {isLoading ? '...' : `${summary.linkedReleases} Linked (${summary.releaseCoverage}%)`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Step 12: Data Quality & Traceability Coverage Section */}
        <section className="card" id="traceability-coverage-card" style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>
                Traceability Coverage
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Derivation based on real MongoDB baseline relationships and Plastic SCM changesets.
              </p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.4rem', fontWeight: '800', color: summary.coveragePercentage >= 80 ? 'var(--success)' : 'var(--primary)' }}>
                {summary.coveragePercentage}%
              </span>
              <span className="status-pill status-active" style={{ fontSize: '0.75rem' }}>
                {summary.coveragePercentage === 100 ? 'Fully Traceable' : 'Active Baseline'}
              </span>
            </div>
          </div>

          <div className="coverage-bar-track" style={{ background: '#e2e8f0', borderRadius: '8px', height: '12px', width: '100%', overflow: 'hidden', marginBottom: '1rem' }}>
            <div
              className="coverage-bar-fill"
              style={{
                width: `${summary.coveragePercentage}%`,
                height: '100%',
                background: summary.coveragePercentage >= 80
                  ? 'linear-gradient(90deg, #3b82f6, #10b981)'
                  : 'linear-gradient(90deg, #f59e0b, #3b82f6)',
                transition: 'width 0.6s ease'
              }}
            />
          </div>

          <div className="coverage-breakdown-grid">
            <div className="coverage-item">
              <span className="coverage-label">CRs &rarr; Downstream</span>
              <span className="coverage-val">{summary.crCoverage}%</span>
            </div>
            <div className="coverage-item">
              <span className="coverage-label">Bugs &rarr; Versions</span>
              <span className="coverage-val">{summary.bugCoverage}%</span>
            </div>
            <div className="coverage-item">
              <span className="coverage-label">Versions &rarr; UVCS</span>
              <span className="coverage-val">{summary.uvcsCoverage}%</span>
            </div>
            <div className="coverage-item">
              <span className="coverage-label">Versions &rarr; Releases</span>
              <span className="coverage-val">{summary.releaseCoverage}%</span>
            </div>
          </div>
        </section>

        {/* Step 9: Visual Traceability Mode (Lifecycle Nodes) */}
        <section className="card" id="visual-lifecycle-card" style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: 0 }}>
                SCM Lifecycle Traceability Flow
              </h3>
              <p style={{ margin: '0.2rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {activeRow
                  ? `Showing active configuration chain for row #${selectedRowIndex + 1} (${activeRow.project.name})`
                  : 'Conceptual lifecycle flow from change initiation to production delivery'}
              </p>
            </div>
            {rows.length > 1 && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Row {selectedRowIndex + 1} of {rows.length} (Click table row to inspect)
              </div>
            )}
          </div>

          <div className="lifecycle-flow-wrapper">
            {/* 1. Change Request Node */}
            <div className={`lifecycle-node ${activeRow?.changeRequest ? 'linked' : 'unlinked'}`}>
              <div className="node-stage-badge">1. Change Request</div>
              {activeRow?.changeRequest ? (
                <>
                  <div className="node-title">{activeRow.changeRequest.title}</div>
                  <div className="node-meta" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                    <span className="node-key">{activeRow.changeRequest.key}</span>
                    <span className={`status-pill ${statusBadgeColors[activeRow.changeRequest.status] || 'status-pending'}`}>
                      {activeRow.changeRequest.status}
                    </span>
                    <Link
                      to={`/impact-analysis?changeRequest=${activeRow.changeRequest.id}`}
                      className="btn-impact-link"
                      style={{
                        fontSize: '0.7rem',
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        background: '#ede9fe',
                        color: '#6d28d9',
                        fontWeight: '600',
                        textDecoration: 'none',
                        marginLeft: 'auto'
                      }}
                    >
                      Impact &rarr;
                    </Link>
                  </div>
                </>
              ) : (
                <div className="node-not-linked">Not linked</div>
              )}
            </div>

            <div className="lifecycle-connector">&rarr;</div>

            {/* 2. Bug / Defect Node */}
            <div className={`lifecycle-node ${activeRow?.bug ? 'linked' : 'unlinked'}`}>
              <div className="node-stage-badge">2. Bug / Defect</div>
              {activeRow?.bug ? (
                <>
                  <div className="node-title">{activeRow.bug.title}</div>
                  <div className="node-meta">
                    <span className="node-key">{activeRow.bug.key}</span>
                    <span className={`status-pill ${statusBadgeColors[activeRow.bug.status] || 'status-pending'}`}>
                      {activeRow.bug.status}
                    </span>
                  </div>
                </>
              ) : (
                <div className="node-not-linked">Not linked</div>
              )}
            </div>

            <div className="lifecycle-connector">&rarr;</div>

            {/* 3. Version Node */}
            <div className={`lifecycle-node ${activeRow?.version ? 'linked' : 'unlinked'}`}>
              <div className="node-stage-badge">3. Software Version</div>
              {activeRow?.version ? (
                <>
                  <div className="node-title">v{activeRow.version.versionNumber}</div>
                  <div className="node-meta">
                    <span className="node-name">{activeRow.version.name}</span>
                    <span className={`status-pill ${statusBadgeColors[activeRow.version.status] || 'status-pending'}`}>
                      {activeRow.version.status}
                    </span>
                  </div>
                </>
              ) : (
                <div className="node-not-linked">Not linked</div>
              )}
            </div>

            <div className="lifecycle-connector">&rarr;</div>

            {/* 4. UVCS Baseline Node */}
            <div className={`lifecycle-node ${activeRow?.uvcs ? 'linked' : 'unlinked'}`}>
              <div className="node-stage-badge">4. UVCS Baseline</div>
              {activeRow?.uvcs ? (
                <>
                  <div className="node-title">Changeset {activeRow.uvcs.changesetId}</div>
                  <div className="node-meta">
                    <span className="uvcs-branch-pill">{activeRow.uvcs.branch}</span>
                    <span className="uvcs-repo-label">{activeRow.uvcs.repository}</span>
                  </div>
                </>
              ) : (
                <div className="node-not-linked">Not linked</div>
              )}
            </div>

            <div className="lifecycle-connector">&rarr;</div>

            {/* 5. Release Node */}
            <div className={`lifecycle-node ${activeRow?.release ? 'linked' : 'unlinked'}`}>
              <div className="node-stage-badge">5. Release Milestone</div>
              {activeRow?.release ? (
                <>
                  <div className="node-title">{activeRow.release.releaseName}</div>
                  <div className="node-meta">
                    <span className={`status-pill ${statusBadgeColors[activeRow.release.status] || 'status-pending'}`}>
                      {activeRow.release.status}
                    </span>
                    <span className="node-date">
                      {activeRow.release.releaseDate ? new Date(activeRow.release.releaseDate).toLocaleDateString() : 'Immediate'}
                    </span>
                  </div>
                </>
              ) : (
                <div className="node-not-linked">Not linked</div>
              )}
            </div>
          </div>
        </section>

        {/* Step 10: Interactive Filters */}
        <section className="card filter-bar-card" style={{ marginBottom: '1.5rem', padding: '1rem 1.25rem' }}>
          <div className="traceability-filters-grid">
            <div className="filter-field">
              <label htmlFor="filter-project" className="filter-label">Project</label>
              <select
                id="filter-project"
                className="form-select"
                value={selectedProject}
                onChange={(e) => setSelectedProject(e.target.value)}
              >
                <option value="">All Accessible Projects</option>
                {projects.map((p) => (
                  <option key={p._id} value={p._id}>
                    {p.name} ({p.key})
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="filter-version" className="filter-label">Version</label>
              <select
                id="filter-version"
                className="form-select"
                value={selectedVersion}
                onChange={(e) => setSelectedVersion(e.target.value)}
              >
                <option value="">All Versions</option>
                {filtersMeta.versions.map((v) => (
                  <option key={v.id} value={v.versionNumber}>
                    v{v.versionNumber} — {v.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="filter-release" className="filter-label">Release</label>
              <select
                id="filter-release"
                className="form-select"
                value={selectedRelease}
                onChange={(e) => setSelectedRelease(e.target.value)}
              >
                <option value="">All Releases</option>
                {filtersMeta.releases.map((r) => (
                  <option key={r.id} value={r.releaseName}>
                    {r.releaseName}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-field">
              <label htmlFor="filter-status" className="filter-label">Status</label>
              <select
                id="filter-status"
                className="form-select"
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
              >
                <option value="">All Lifecycle Statuses</option>
                <option value="published">Published</option>
                <option value="approved">Approved</option>
                <option value="resolved">Resolved</option>
                <option value="implemented">Implemented</option>
                <option value="released">Released</option>
                <option value="open">Open Defect</option>
                <option value="submitted">Submitted CR</option>
                <option value="development">Development</option>
              </select>
            </div>

            <div className="filter-actions" style={{ display: 'flex', alignItems: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-outline"
                id="btn-reset-filters"
                style={{ width: '100%', whiteSpace: 'nowrap' }}
              >
                Reset Filters
              </button>
            </div>
          </div>
        </section>

        {/* Step 8 & Step 11: Traceability Matrix Table */}
        <section className="card table-card" id="traceability-table-card" style={{ padding: 0, overflow: 'hidden' }}>
          <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
              Configuration Baseline Matrix ({rows.length} {rows.length === 1 ? 'Record' : 'Records'})
            </h3>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Click any row to display in lifecycle flow
            </span>
          </div>

          {isLoading ? (
            <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              <div className="spinner" style={{ marginBottom: '1rem' }}></div>
              Loading traceability data from MongoDB...
            </div>
          ) : rows.length === 0 ? (
            <div className="empty-state-card" id="empty-traceability-matrix" style={{ padding: '3rem', textAlign: 'center' }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '0.5rem' }}>🔍</div>
              <h4 style={{ margin: '0 0 0.5rem 0', fontWeight: '600' }}>No traceability relationships found</h4>
              <p style={{ color: 'var(--text-muted)', maxWidth: '480px', margin: '0 auto 1.25rem auto' }}>
                No configuration records matched your selected project or filters. Try resetting the filters or link SCM artifacts using the link button above.
              </p>
              <button onClick={handleResetFilters} className="btn btn-primary btn-sm">
                Reset All Filters
              </button>
            </div>
          ) : (
            <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <table className="data-table traceability-table" id="traceability-matrix-table">
                <thead>
                  <tr>
                    <th style={{ minWidth: '170px' }}>Change Request</th>
                    <th style={{ minWidth: '170px' }}>Bug / Fix</th>
                    <th style={{ minWidth: '140px' }}>Version</th>
                    <th style={{ minWidth: '160px' }}>UVCS Baseline</th>
                    <th style={{ minWidth: '180px' }}>Release</th>
                    <th style={{ minWidth: '140px' }}>Lifecycle Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => {
                    const isSelected = selectedRowIndex === index;
                    return (
                      <tr
                        key={row.id}
                        className={`traceability-row ${isSelected ? 'row-selected' : ''}`}
                        onClick={() => setSelectedRowIndex(index)}
                        style={{ cursor: 'pointer' }}
                      >
                        {/* Change Request Cell */}
                        <td>
                          {row.changeRequest ? (
                            <div className="matrix-cell-content">
                              <Link
                                to={`/projects/${row.project.id}/change-requests/${row.changeRequest.id}`}
                                className="matrix-entity-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="matrix-code-badge">{row.changeRequest.key}</span>
                                <strong className="matrix-title">{row.changeRequest.title}</strong>
                              </Link>
                              <div style={{ marginTop: '0.3rem', display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                                <span className={`status-pill ${statusBadgeColors[row.changeRequest.status] || 'status-pending'}`}>
                                  {row.changeRequest.status}
                                </span>
                                <Link
                                  to={`/impact-analysis?changeRequest=${row.changeRequest.id}`}
                                  className="btn-impact-link"
                                  onClick={(e) => e.stopPropagation()}
                                  title="Analyze SCM Change Impact"
                                  style={{
                                    fontSize: '0.72rem',
                                    padding: '0.12rem 0.45rem',
                                    borderRadius: '4px',
                                    background: '#ede9fe',
                                    color: '#6d28d9',
                                    fontWeight: '600',
                                    textDecoration: 'none',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: '0.2rem'
                                  }}
                                >
                                  ⚡ Impact &rarr;
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <span className="not-linked-badge">Not linked</span>
                          )}
                        </td>

                        {/* Bug / Fix Cell */}
                        <td>
                          {row.bug ? (
                            <div className="matrix-cell-content">
                              <Link
                                to={`/projects/${row.project.id}/bugs/${row.bug.id}`}
                                className="matrix-entity-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="matrix-code-badge">{row.bug.key}</span>
                                <strong className="matrix-title">{row.bug.title}</strong>
                              </Link>
                              <div style={{ marginTop: '0.25rem', display: 'flex', gap: '0.35rem' }}>
                                <span className={`status-pill ${statusBadgeColors[row.bug.status] || 'status-pending'}`}>
                                  {row.bug.status}
                                </span>
                                {row.bug.severity && (
                                  <span className="severity-badge" style={{ fontSize: '0.7rem', padding: '0.1rem 0.35rem' }}>
                                    {row.bug.severity}
                                  </span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="not-linked-badge">Not linked</span>
                          )}
                        </td>

                        {/* Version Cell */}
                        <td>
                          {row.version ? (
                            <div className="matrix-cell-content">
                              <Link
                                to={`/projects/${row.project.id}/versions/${row.version.id}`}
                                className="matrix-entity-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <strong className="matrix-title" style={{ fontSize: '0.95rem' }}>
                                  v{row.version.versionNumber}
                                </strong>
                              </Link>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                                {row.version.name}
                              </div>
                              <div style={{ marginTop: '0.25rem' }}>
                                <span className={`status-pill ${statusBadgeColors[row.version.status] || 'status-pending'}`}>
                                  {row.version.status}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="not-linked-badge">Not linked</span>
                          )}
                        </td>

                        {/* UVCS Baseline Cell */}
                        <td>
                          {row.uvcs && row.uvcs.changesetId !== null ? (
                            <div className="matrix-cell-content">
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                                <span className="uvcs-changeset-pill">cs:{row.uvcs.changesetId}</span>
                                <span className="uvcs-branch-badge">{row.uvcs.branch}</span>
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                                {row.uvcs.repository}
                              </div>
                            </div>
                          ) : (
                            <span className="not-linked-badge" title="No UVCS baseline linked to this version">
                              Not linked
                            </span>
                          )}
                        </td>

                        {/* Release Cell */}
                        <td>
                          {row.release ? (
                            <div className="matrix-cell-content">
                              <Link
                                to={`/projects/${row.project.id}/releases/${row.release.id}`}
                                className="matrix-entity-link"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <strong className="matrix-title">{row.release.releaseName}</strong>
                              </Link>
                              <div style={{ marginTop: '0.25rem' }}>
                                <span className={`status-pill ${statusBadgeColors[row.release.status] || 'status-pending'}`}>
                                  {row.release.status}
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span className="not-linked-badge">Not linked</span>
                          )}
                        </td>

                        {/* Lifecycle Status & Relationship Cell */}
                        <td>
                          <div className="matrix-cell-content">
                            <span className="lifecycle-stage-text">
                              {row.lifecycleStage}
                            </span>
                            <div style={{ marginTop: '0.25rem' }}>
                              <span
                                className={`relation-type-tag relation-${row.relationshipType}`}
                                title={`Relationship type: ${row.relationshipType}`}
                              >
                                {row.relationshipType}
                              </span>
                            </div>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Link Artifacts Modal */}
        {showLinkModal && (
          <div className="modal-backdrop" style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
            <div className="card modal-content" style={{ width: '100%', maxWidth: '520px', padding: '1.5rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
                <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '700' }}>
                  Establish SCM Traceability Link
                </h3>
                <button
                  type="button"
                  onClick={() => setShowLinkModal(false)}
                  style={{ background: 'none', border: 'none', fontSize: '1.2rem', cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginTop: 0, marginBottom: '1.25rem' }}>
                Select artifacts to establish direct traceable relationships. This will update MongoDB and record an official audit log event.
              </p>

              {linkError && (
                <div className="alert alert-danger" style={{ marginBottom: '1rem' }}>
                  {linkError}
                </div>
              )}

              <form onSubmit={handleCreateLink}>
                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.88rem' }}>Target Project</label>
                  <select
                    className="form-select"
                    value={linkingProject}
                    onChange={(e) => setLinkingProject(e.target.value)}
                    required
                  >
                    {projects.map((p) => (
                      <option key={p._id} value={p._id}>{p.name} ({p.key})</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.88rem' }}>Change Request (Optional)</label>
                  <select
                    className="form-select"
                    value={linkCRId}
                    onChange={(e) => setLinkCRId(e.target.value)}
                  >
                    <option value="">-- None Selected --</option>
                    {rows.filter((r) => r.changeRequest).map((r) => (
                      <option key={r.changeRequest.id} value={r.changeRequest.id}>
                        {r.changeRequest.key} — {r.changeRequest.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.88rem' }}>Bug / Defect (Optional)</label>
                  <select
                    className="form-select"
                    value={linkBugId}
                    onChange={(e) => setLinkBugId(e.target.value)}
                  >
                    <option value="">-- None Selected --</option>
                    {rows.filter((r) => r.bug).map((r) => (
                      <option key={r.bug.id} value={r.bug.id}>
                        {r.bug.key} — {r.bug.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1rem' }}>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.88rem' }}>Software Version (Optional)</label>
                  <select
                    className="form-select"
                    value={linkVersionId}
                    onChange={(e) => setLinkVersionId(e.target.value)}
                  >
                    <option value="">-- None Selected --</option>
                    {filtersMeta.versions.map((v) => (
                      <option key={v.id} value={v.id}>
                        v{v.versionNumber} — {v.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                  <label className="form-label" style={{ fontWeight: '600', fontSize: '0.88rem' }}>Release Milestone (Optional)</label>
                  <select
                    className="form-select"
                    value={linkReleaseId}
                    onChange={(e) => setLinkReleaseId(e.target.value)}
                  >
                    <option value="">-- None Selected --</option>
                    {filtersMeta.releases.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.releaseName}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                  <button
                    type="button"
                    onClick={() => setShowLinkModal(false)}
                    className="btn btn-outline"
                    disabled={isSubmittingLink}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmittingLink}
                  >
                    {isSubmittingLink ? 'Linking...' : 'Establish Link'}
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

export default Traceability;
