import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { reportService, projectService } from '../services/api';

const severityColors = {
  critical: '#dc2626',
  high: '#ea580c',
  medium: '#0284c7',
  low: '#16a34a'
};

const releaseStatusColors = {
  draft: '#64748b',
  pending_approval: '#d97706',
  approved: '#4f46e5',
  published: '#16a34a',
  withdrawn: '#dc2626'
};

const Reports = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialProjectId = searchParams.get('project') || '';

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(initialProjectId);

  // Global overview state
  const [overview, setOverview] = useState(null);
  const [isLoadingOverview, setIsLoadingOverview] = useState(true);

  // Project-specific state
  const [projectReport, setProjectReport] = useState(null);
  const [qualityReport, setQualityReport] = useState(null);
  const [releaseReport, setReleaseReport] = useState(null);
  const [isLoadingProject, setIsLoadingProject] = useState(false);

  const [errorMessage, setErrorMessage] = useState('');

  // 1. Fetch initial overview and projects list
  const fetchInitialData = async () => {
    try {
      setIsLoadingOverview(true);
      setErrorMessage('');

      const [overviewRes, projectsRes] = await Promise.all([
        reportService.getOverview(),
        projectService.getProjects()
      ]);

      if (overviewRes.success) {
        setOverview(overviewRes.data);
      }

      if (projectsRes.success) {
        setProjects(projectsRes.projects || []);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load SCM reports overview');
    } finally {
      setIsLoadingOverview(false);
    }
  };

  // 2. Fetch project-specific reports
  const fetchProjectData = async (projectId) => {
    if (!projectId) {
      setProjectReport(null);
      setQualityReport(null);
      setReleaseReport(null);
      return;
    }

    try {
      setIsLoadingProject(true);
      setErrorMessage('');

      const [pRes, qRes, rRes] = await Promise.all([
        reportService.getProjectReport(projectId),
        reportService.getProjectQuality(projectId),
        reportService.getProjectReleases(projectId)
      ]);

      if (pRes.success) setProjectReport(pRes.data);
      if (qRes.success) setQualityReport(qRes.data);
      if (rRes.success) setReleaseReport(rRes.data);
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load project-specific report data');
    } finally {
      setIsLoadingProject(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  // Update selection if query param changes or projects load
  useEffect(() => {
    const queryProj = searchParams.get('project');
    if (queryProj && queryProj !== selectedProjectId) {
      setSelectedProjectId(queryProj);
      fetchProjectData(queryProj);
    } else if (selectedProjectId) {
      fetchProjectData(selectedProjectId);
    }
  }, [searchParams]);

  const handleProjectSelect = (e) => {
    const projId = e.target.value;
    setSelectedProjectId(projId);
    if (projId) {
      setSearchParams({ project: projId });
      fetchProjectData(projId);
    } else {
      setSearchParams({});
      setProjectReport(null);
      setQualityReport(null);
      setReleaseReport(null);
    }
  };

  const selectedProject = projects.find((p) => p._id === selectedProjectId);

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="main-content">
        {/* Page Header */}
        <div className="page-header-row">
          <div>
            <h2>Reports &amp; SCM Analytics</h2>
            <p className="page-subtitle">
              Comprehensive real-time metrics, defect quality analysis, and release governance derived from MongoDB.
            </p>
          </div>

          {/* Project Selector Dropdown */}
          <div className="report-filter-box">
            <label htmlFor="report-project-select" className="filter-label">
              Filter by Project:
            </label>
            <select
              id="report-project-select"
              value={selectedProjectId}
              onChange={handleProjectSelect}
              className="form-select project-filter-select"
            >
              <option value="">-- All Projects (Global SCM Overview) --</option>
              {projects.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} ({p.key})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Error Notification */}
        {errorMessage && (
          <div className="alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMessage}</span>
            <button
              onClick={() => {
                fetchInitialData();
                if (selectedProjectId) fetchProjectData(selectedProjectId);
              }}
              className="btn-retry-small"
              id="btn-retry-reports"
            >
              Retry
            </button>
          </div>
        )}

        {/* Global Loading State */}
        {isLoadingOverview ? (
          <div className="page-loading-state" id="reports-loading-spinner">
            <div className="spinner"></div>
            <p>Aggregating configuration management metrics across MongoDB collections...</p>
          </div>
        ) : (
          <>
            {/* ============================================================= */}
            {/* SECTION 1: GLOBAL SCM OVERVIEW METRICS                         */}
            {/* ============================================================= */}
            <section className="stats-section">
              <div className="section-title-row">
                <div>
                  <h3>Global Configuration Management Overview</h3>
                  <p>Aggregated portfolio baselines across all registered repositories.</p>
                </div>
                {selectedProjectId && (
                  <button
                    onClick={() => {
                      setSelectedProjectId('');
                      setSearchParams({});
                    }}
                    className="btn-secondary-small"
                  >
                    Clear Filter
                  </button>
                )}
              </div>

              {overview && (
                <div className="stats-grid stats-grid-5">
                  <div className="stat-card" id="overview-total-projects">
                    <div className="stat-icon-wrapper blue">📁</div>
                    <div className="stat-content">
                      <span className="stat-label">Total Projects</span>
                      <span className="stat-value">{overview.totalProjects}</span>
                      <span className="stat-subtext">
                        {overview.activeProjects} active &bull; {overview.completedProjects} completed
                      </span>
                    </div>
                  </div>

                  <div className="stat-card" id="overview-total-versions">
                    <div className="stat-icon-wrapper amber">🚀</div>
                    <div className="stat-content">
                      <span className="stat-label">Total Versions</span>
                      <span className="stat-value">{overview.totalVersions}</span>
                      <span className="stat-subtext">
                        {overview.releasedVersions} released &bull; {overview.versionsInDevelopment} in dev
                      </span>
                    </div>
                  </div>

                  <div className="stat-card" id="overview-total-bugs">
                    <div className="stat-icon-wrapper red">🐛</div>
                    <div className="stat-content">
                      <span className="stat-label">Total Defects</span>
                      <span className="stat-value">{overview.totalBugs}</span>
                      <span className="stat-subtext">
                        {overview.openBugs} open &bull; {overview.resolvedBugs} resolved
                      </span>
                    </div>
                  </div>

                  <div className="stat-card" id="overview-total-crs">
                    <div className="stat-icon-wrapper purple">📝</div>
                    <div className="stat-content">
                      <span className="stat-label">Change Requests</span>
                      <span className="stat-value">{overview.totalChangeRequests}</span>
                      <span className="stat-subtext">
                        {overview.pendingChangeRequests} pending &bull; {overview.approvedChangeRequests} approved
                      </span>
                    </div>
                  </div>

                  <div className="stat-card" id="overview-total-releases">
                    <div className="stat-icon-wrapper green">📦</div>
                    <div className="stat-content">
                      <span className="stat-label">Total Releases</span>
                      <span className="stat-value">{overview.totalReleases}</span>
                      <span className="stat-subtext">
                        {overview.publishedReleases} published &bull; {overview.draftReleases} draft
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </section>

            {/* ============================================================= */}
            {/* SECTION 2: PROJECT-SPECIFIC REPORT DEEP DIVE                   */}
            {/* ============================================================= */}
            {selectedProjectId && (
              <>
                {isLoadingProject ? (
                  <div className="page-loading-state" style={{ minHeight: '200px' }}>
                    <div className="spinner"></div>
                    <p>Loading project analytics for {selectedProject?.name || 'project'}...</p>
                  </div>
                ) : projectReport ? (
                  <div className="project-report-container">
                    {/* Project Header Banner */}
                    <div className="card project-summary-banner" style={{ marginBottom: '1.5rem' }}>
                      <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
                            <h3 style={{ margin: 0 }}>{projectReport.project.name}</h3>
                            <span className="project-key-tag">{projectReport.project.key}</span>
                            <span className={`status-pill status-${projectReport.project.status}`}>
                              {projectReport.project.status}
                            </span>
                          </div>
                          <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                            Owner: <strong>{projectReport.project.owner?.name}</strong> ({projectReport.project.owner?.email}) &bull;{' '}
                            Members: {projectReport.project.membersCount} &bull;{' '}
                            Registered: {new Date(projectReport.project.createdAt).toLocaleDateString()}
                          </p>
                        </div>

                        <Link to={`/projects/${projectReport.project._id}`} className="btn-secondary">
                          Go to Project Workspace &rarr;
                        </Link>
                      </div>
                    </div>

                    {/* Project Metrics Grid */}
                    <div className="stats-grid stats-grid-4" style={{ marginBottom: '1.5rem' }}>
                      <div className="stat-card">
                        <div className="stat-icon-wrapper blue">🚀</div>
                        <div className="stat-content">
                          <span className="stat-label">Project Versions</span>
                          <span className="stat-value">{projectReport.totalVersions}</span>
                          <span className="stat-subtext">
                            {projectReport.versionStatusBreakdown.released} Released &bull;{' '}
                            {projectReport.versionStatusBreakdown.testing} Testing
                          </span>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-icon-wrapper red">🐛</div>
                        <div className="stat-content">
                          <span className="stat-label">Project Defects</span>
                          <span className="stat-value">{projectReport.totalBugs}</span>
                          <span className="stat-subtext">
                            {projectReport.bugStatusBreakdown.resolved + projectReport.bugStatusBreakdown.closed} Resolved
                          </span>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-icon-wrapper purple">📝</div>
                        <div className="stat-content">
                          <span className="stat-label">Change Requests</span>
                          <span className="stat-value">{projectReport.totalChangeRequests}</span>
                          <span className="stat-subtext">
                            {projectReport.changeRequestStatusBreakdown.approved} Approved
                          </span>
                        </div>
                      </div>

                      <div className="stat-card">
                        <div className="stat-icon-wrapper green">📦</div>
                        <div className="stat-content">
                          <span className="stat-label">Formal Releases</span>
                          <span className="stat-value">{projectReport.totalReleases}</span>
                          <span className="stat-subtext">
                            {projectReport.releaseStatusBreakdown.published} Published
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Quality & Release Governance Two-Column Grid */}
                    <div className="details-grid" style={{ marginBottom: '1.5rem' }}>
                      {/* Quality Metrics Card */}
                      <div className="card" id="project-quality-card">
                        <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <h3>Quality &amp; Defect Metrics</h3>
                          {qualityReport && (
                            <span
                              className="badge-tag"
                              id="quality-resolution-percentage"
                              style={{
                                background: qualityReport.resolutionPercentage >= 70 ? '#dcfce7' : qualityReport.resolutionPercentage >= 40 ? '#fef3c7' : '#fee2e2',
                                color: qualityReport.resolutionPercentage >= 70 ? '#166534' : qualityReport.resolutionPercentage >= 40 ? '#92400e' : '#991b1b',
                                fontWeight: 700,
                                fontSize: '0.85rem'
                              }}
                            >
                              {qualityReport.resolutionPercentage}% Resolved
                            </span>
                          )}
                        </div>
                        <div className="card-body">
                          {qualityReport && qualityReport.totalBugs > 0 ? (
                            <div>
                              {/* Resolution Progress Bar */}
                              <div style={{ marginBottom: '1.25rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '0.35rem' }}>
                                  <span>Defect Resolution Rate</span>
                                  <strong>{qualityReport.resolutionPercentage}%</strong>
                                </div>
                                <div className="progress-bar-container">
                                  <div
                                    className="progress-bar-fill"
                                    style={{
                                      width: `${Math.min(qualityReport.resolutionPercentage, 100)}%`,
                                      background: qualityReport.resolutionPercentage >= 70 ? '#16a34a' : qualityReport.resolutionPercentage >= 40 ? '#d97706' : '#dc2626'
                                    }}
                                  />
                                </div>
                              </div>

                              {/* Severity Distribution */}
                              <div style={{ marginBottom: '1.25rem' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#475569' }}>
                                  Defect Severity Breakdown
                                </h4>
                                <div className="distribution-list">
                                  <div className="dist-item">
                                    <div className="dist-label">
                                      <span className="dot" style={{ background: severityColors.critical }}></span>
                                      <span>Critical</span>
                                    </div>
                                    <span className="dist-count">{qualityReport.criticalBugs}</span>
                                  </div>
                                  <div className="dist-item">
                                    <div className="dist-label">
                                      <span className="dot" style={{ background: severityColors.high }}></span>
                                      <span>High</span>
                                    </div>
                                    <span className="dist-count">{qualityReport.highSeverityBugs}</span>
                                  </div>
                                  <div className="dist-item">
                                    <div className="dist-label">
                                      <span className="dot" style={{ background: severityColors.medium }}></span>
                                      <span>Medium</span>
                                    </div>
                                    <span className="dist-count">{qualityReport.mediumSeverityBugs}</span>
                                  </div>
                                  <div className="dist-item">
                                    <div className="dist-label">
                                      <span className="dot" style={{ background: severityColors.low }}></span>
                                      <span>Low</span>
                                    </div>
                                    <span className="dist-count">{qualityReport.lowSeverityBugs}</span>
                                  </div>
                                </div>
                              </div>

                              {/* Status Distribution */}
                              <div>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#475569' }}>
                                  Defect Lifecycle Statuses
                                </h4>
                                <div className="tag-cloud">
                                  <span className="status-pill status-open">Open: {qualityReport.openBugs}</span>
                                  <span className="status-pill status-in_progress">In Progress: {qualityReport.inProgressBugs}</span>
                                  <span className="status-pill status-resolved">Resolved: {qualityReport.resolvedBugs}</span>
                                  <span className="status-pill status-closed">Closed: {qualityReport.closedBugs}</span>
                                  {qualityReport.reopenedBugs > 0 && (
                                    <span className="status-pill status-reopened">Reopened: {qualityReport.reopenedBugs}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem 0' }}>
                              No defects recorded for this project repository.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Release Governance Card */}
                      <div className="card" id="project-releases-card">
                        <div className="card-header">
                          <h3>Release Governance Breakdown</h3>
                        </div>
                        <div className="card-body">
                          {releaseReport && releaseReport.totalReleases > 0 ? (
                            <div>
                              <div className="distribution-list" style={{ marginBottom: '1.25rem' }}>
                                <div className="dist-item">
                                  <div className="dist-label">
                                    <span className="dot" style={{ background: releaseStatusColors.published }}></span>
                                    <span>Published</span>
                                  </div>
                                  <span className="dist-count">{releaseReport.publishedReleases}</span>
                                </div>
                                <div className="dist-item">
                                  <div className="dist-label">
                                    <span className="dot" style={{ background: releaseStatusColors.approved }}></span>
                                    <span>Approved</span>
                                  </div>
                                  <span className="dist-count">{releaseReport.approvedReleases}</span>
                                </div>
                                <div className="dist-item">
                                  <div className="dist-label">
                                    <span className="dot" style={{ background: releaseStatusColors.pending_approval }}></span>
                                    <span>Pending Approval</span>
                                  </div>
                                  <span className="dist-count">{releaseReport.pendingApprovalReleases}</span>
                                </div>
                                <div className="dist-item">
                                  <div className="dist-label">
                                    <span className="dot" style={{ background: releaseStatusColors.draft }}></span>
                                    <span>Draft</span>
                                  </div>
                                  <span className="dist-count">{releaseReport.draftReleases}</span>
                                </div>
                                {releaseReport.withdrawnReleases > 0 && (
                                  <div className="dist-item">
                                    <div className="dist-label">
                                      <span className="dot" style={{ background: releaseStatusColors.withdrawn }}></span>
                                      <span>Withdrawn</span>
                                    </div>
                                    <span className="dist-count">{releaseReport.withdrawnReleases}</span>
                                  </div>
                                )}
                              </div>

                              {/* Recent Project Deployments */}
                              <h4 style={{ fontSize: '0.9rem', marginBottom: '0.5rem', color: '#475569' }}>
                                Recent Release Baselines
                              </h4>
                              <div className="recent-releases-mini-list">
                                {releaseReport.recentReleases.slice(0, 4).map((rel) => (
                                  <div key={rel._id} className="mini-rel-item">
                                    <div>
                                      <strong>{rel.releaseName}</strong>
                                      <span className="version-tag" style={{ marginLeft: '0.5rem' }}>v{rel.versionNumber}</span>
                                    </div>
                                    <span className={`status-pill status-${rel.status}`}>
                                      {rel.status}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : (
                            <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', padding: '1.5rem 0' }}>
                              No formal releases registered for this project yet.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Recent Project Activity Timeline */}
                    <div className="card">
                      <div className="card-header">
                        <h3>Recent Project Timeline Activity</h3>
                      </div>
                      <div className="card-body">
                        {projectReport.recentActivity && projectReport.recentActivity.length > 0 ? (
                          <div className="activity-timeline">
                            {projectReport.recentActivity.map((act, idx) => (
                              <div key={idx} className="timeline-item">
                                <span className={`activity-icon icon-${act.type}`}>
                                  {act.type === 'version' && '🚀'}
                                  {act.type === 'bug' && '🐛'}
                                  {act.type === 'change_request' && '📝'}
                                  {act.type === 'release' && '📦'}
                                </span>
                                <div className="timeline-content">
                                  <span className="timeline-title">{act.title}</span>
                                  <div className="timeline-meta">
                                    <span className={`status-pill status-${act.status}`} style={{ fontSize: '0.7rem', padding: '0.1rem 0.45rem' }}>
                                      {act.status}
                                    </span>
                                    <span className="timeline-date">
                                      {new Date(act.date).toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p style={{ margin: 0, color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            No activity recorded yet for this project.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            )}

            {/* ============================================================= */}
            {/* SECTION 3: PROJECT PORTFOLIO SUMMARY TABLE                     */}
            {/* ============================================================= */}
            {!selectedProjectId && (
              <section className="card" style={{ marginTop: '1.5rem' }}>
                <div className="card-header">
                  <h3>Repository Portfolio Summary</h3>
                  <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Overview of all projects registered in Smart SCM. Click any row or use the selector above to drill down.
                  </p>
                </div>
                <div className="card-body">
                  {projects.length === 0 ? (
                    <div className="empty-state-card">
                      <p>No projects registered in MongoDB yet.</p>
                      <Link to="/projects" className="btn-action-primary">
                        + Create First Project
                      </Link>
                    </div>
                  ) : (
                    <div className="table-responsive">
                      <table className="data-table" id="projects-portfolio-table">
                        <thead>
                          <tr>
                            <th>Project</th>
                            <th>Key</th>
                            <th>Status</th>
                            <th>Owner</th>
                            <th>Members</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {projects.map((p) => (
                            <tr key={p._id}>
                              <td>
                                <strong>{p.name}</strong>
                                {p.description && (
                                  <p className="project-desc-excerpt">{p.description}</p>
                                )}
                              </td>
                              <td>
                                <span className="project-key-tag">{p.key}</span>
                              </td>
                              <td>
                                <span className={`status-pill status-${p.status}`}>
                                  {p.status}
                                </span>
                              </td>
                              <td>
                                <span className="owner-name">{p.owner?.name || 'Owner'}</span>
                              </td>
                              <td>{p.members?.length || 0}</td>
                              <td>
                                <button
                                  onClick={() => {
                                    setSelectedProjectId(p._id);
                                    setSearchParams({ project: p._id });
                                    fetchProjectData(p._id);
                                  }}
                                  className="btn-table-action"
                                  id={`btn-view-report-${p.key}`}
                                >
                                  View Analytics &rarr;
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* Configuration Management Traceability Card */}
            <div className="card traceability-card" style={{ marginTop: '1.5rem' }}>
              <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ margin: 0 }}>SCM Configuration Management Architecture</h3>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                    Reports compute live metrics from MongoDB application-level baselines, releases, and defect tracking.
                  </p>
                </div>
                <span className="badge-upcoming">Phase 9 Operational</span>
              </div>
              <div className="card-body">
                <div className="traceability-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
                  <div className="trace-item" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                      Application Data Source
                    </span>
                    <strong style={{ fontSize: '1rem', color: '#1e293b' }}>MongoDB Persistence</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      Real-time aggregation across projects, versions, defects, change requests, and releases.
                    </p>
                  </div>

                  <div className="trace-item" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '0.75rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 700, display: 'block', marginBottom: '0.25rem' }}>
                      Source Code Version Control
                    </span>
                    <strong style={{ fontSize: '1rem', color: '#1e293b' }}>Unity Version Control</strong>
                    <p style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#64748b' }}>
                      Source-code commits, branches, merges, and rollbacks are maintained in Unity Version Control.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Reports;
