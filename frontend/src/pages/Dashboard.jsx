import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { projectService, versionService, bugService, changeRequestService, releaseService, auditService } from '../services/api';

const roleLabels = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  developer: 'Developer',
  tester: 'QA / Tester'
};

const releaseStatusLabels = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  published: 'Published',
  withdrawn: 'Withdrawn'
};

const getActivityIcon = (action) => {
  switch (action) {
    case 'PROJECT_CREATED':
    case 'PROJECT_UPDATED': return '📁';
    case 'VERSION_CREATED':
    case 'VERSION_UPDATED': return '🏷️';
    case 'BUG_CREATED':
    case 'BUG_UPDATED': return '🐛';
    case 'CHANGE_REQUEST_CREATED':
    case 'CHANGE_REQUEST_STATUS_CHANGED': return '📝';
    case 'RELEASE_CREATED':
    case 'RELEASE_APPROVED':
    case 'RELEASE_PUBLISHED': return '🚀';
    case 'UVCS_BASELINE_LINKED': return '🔄';
    default: return '📌';
  }
};

const Dashboard = () => {
  const { user } = useAuth();

  // Project statistics state
  const [projectStats, setProjectStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    planningProjects: 0,
    archivedProjects: 0
  });

  // Version statistics state (Phase 6)
  const [versionStats, setVersionStats] = useState({
    totalVersions: 0,
    development: 0,
    testing: 0,
    released: 0,
    deprecated: 0
  });

  // Bug statistics state (Phase 7)
  const [bugStats, setBugStats] = useState({
    totalBugs: 0,
    openBugs: 0,
    inProgressBugs: 0,
    resolvedBugs: 0,
    closedBugs: 0,
    reopenedBugs: 0
  });

  // Change Request statistics state (Phase 7)
  const [crStats, setCrStats] = useState({
    totalCRs: 0,
    pendingCRs: 0,
    approvedCRs: 0,
    implementedCRs: 0,
    rejectedCRs: 0,
    cancelledCRs: 0
  });

  // Release statistics state (Phase 8)
  const [releaseStats, setReleaseStats] = useState({
    totalReleases: 0,
    draftReleases: 0,
    pendingApproval: 0,
    approvedReleases: 0,
    publishedReleases: 0,
    withdrawnReleases: 0
  });

  // Recent releases list (Phase 8)
  const [recentReleases, setRecentReleases] = useState([]);
  // Recent activities list (Phase 13)
  const [recentActivities, setRecentActivities] = useState([]);
  const [primaryProject, setPrimaryProject] = useState(null);

  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoadingStats(true);
        setStatsError('');

        const [projRes, verRes, bugRes, crRes, relRes, recentRes, projsListRes, auditRes] = await Promise.all([
          projectService.getProjectStats(),
          versionService.getVersionStats(),
          bugService.getBugStats(),
          changeRequestService.getChangeRequestStats(),
          releaseService.getReleaseStats(),
          releaseService.getRecentReleases(),
          projectService.getProjects(),
          auditService.getAuditLogs({ limit: 6 }).catch(() => ({ success: false, auditLogs: [] }))
        ]);

        if (projRes.success && projRes.stats) {
          setProjectStats(projRes.stats);
        }

        if (verRes.success && verRes.stats) {
          setVersionStats(verRes.stats);
        }

        if (bugRes.success && bugRes.stats) {
          setBugStats(bugRes.stats);
        }

        if (crRes.success && crRes.stats) {
          setCrStats(crRes.stats);
        }

        if (relRes.success && relRes.stats) {
          setReleaseStats(relRes.stats);
        }

        if (recentRes.success && recentRes.releases) {
          setRecentReleases(recentRes.releases);
        }

        if (auditRes.success && auditRes.auditLogs) {
          setRecentActivities(auditRes.auditLogs);
        }

        if (projsListRes.success && projsListRes.projects) {
          const primary = projsListRes.projects.find((p) => p.key === 'SMART-SCM') || projsListRes.projects[0];
          setPrimaryProject(primary || null);
        }
      } catch (error) {
        console.error('Failed to load dashboard statistics:', error.message);
        setStatsError('Unable to load live system statistics.');
      } finally {
        setIsLoadingStats(false);
      }
    };

    loadStats();
  }, []);

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="main-content">
        <div className="dashboard-hero">
          <h1>Welcome, {user?.name || 'Team Member'}</h1>
          <p>Configuration Management and Release Governance System</p>
        </div>

        {/* Global Error Banner */}
        {statsError && (
          <div className="alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{statsError}</span>
          </div>
        )}

        {/* SCM Analytics Overview Banner */}
        <section className="stats-section scm-analytics-summary" style={{ marginBottom: '2rem' }}>
          <div className="section-title-row">
            <div>
              <h3>SCM Intelligence &amp; Analytics Summary</h3>
              <p>Real-time cross-repository configuration metrics computed directly from MongoDB.</p>
            </div>
            <Link to="/reports" className="btn-action-primary" id="dashboard-btn-reports">
              📊 View Reports &rarr;
            </Link>
          </div>

          <div className="stats-grid stats-grid-5" id="dashboard-analytics-summary-grid">
            <div className="stat-card" id="dash-summary-projects">
              <div className="stat-icon-wrapper blue">📁</div>
              <div className="stat-content">
                <span className="stat-label">Projects</span>
                <span className="stat-value">{isLoadingStats ? '...' : projectStats.totalProjects}</span>
                <span className="stat-subtext">{projectStats.activeProjects} active</span>
              </div>
            </div>

            <div className="stat-card" id="dash-summary-versions">
              <div className="stat-icon-wrapper amber">🚀</div>
              <div className="stat-content">
                <span className="stat-label">Versions</span>
                <span className="stat-value">{isLoadingStats ? '...' : versionStats.totalVersions}</span>
                <span className="stat-subtext">{versionStats.released} released</span>
              </div>
            </div>

            <div className="stat-card" id="dash-summary-bugs">
              <div className="stat-icon-wrapper red">🐛</div>
              <div className="stat-content">
                <span className="stat-label">Defects</span>
                <span className="stat-value">{isLoadingStats ? '...' : bugStats.totalBugs}</span>
                <span className="stat-subtext">{bugStats.resolvedBugs + bugStats.closedBugs} resolved</span>
              </div>
            </div>

            <div className="stat-card" id="dash-summary-crs">
              <div className="stat-icon-wrapper purple">📝</div>
              <div className="stat-content">
                <span className="stat-label">Change Requests</span>
                <span className="stat-value">{isLoadingStats ? '...' : crStats.totalCRs}</span>
                <span className="stat-subtext">{crStats.approvedCRs} approved</span>
              </div>
            </div>

            <div className="stat-card" id="dash-summary-releases">
              <div className="stat-icon-wrapper green">📦</div>
              <div className="stat-content">
                <span className="stat-label">Releases</span>
                <span className="stat-value">{isLoadingStats ? '...' : releaseStats.totalReleases}</span>
                <span className="stat-subtext">{releaseStats.publishedReleases} published</span>
              </div>
            </div>
          </div>
        </section>

        {/* Primary Demo Project Spotlight Banner */}
        {primaryProject && (
          <section className="card demo-project-spotlight-card" style={{ marginBottom: '2.5rem', borderLeft: '4px solid var(--primary)', background: 'linear-gradient(to right, #ffffff, #f8fafc)' }}>
            <div className="card-body" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                  <span className="project-key-tag large">{primaryProject.key}</span>
                  <span className="status-pill status-active">● Active Baseline</span>
                  <span className="badge-tag cr-tag" style={{ fontSize: '0.75rem' }}>⭐ Primary Demo Project</span>
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--text-main)', margin: '0.2rem 0' }}>
                  {primaryProject.name}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.92rem', margin: 0 }}>
                  {primaryProject.description}
                </p>
                <div style={{ display: 'flex', gap: '1.25rem', marginTop: '0.75rem', flexWrap: 'wrap', fontSize: '0.85rem' }}>
                  <span><strong>Baseline Version:</strong> <span className="version-number-tag">v1.0.0</span></span>
                  <span><strong>UVCS Anchor:</strong> <code style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>cs:0@/main (default@local)</code></span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <Link
                  to={`/projects/${primaryProject._id}`}
                  className="btn-action-primary"
                  id="dashboard-btn-demo-project"
                >
                  🚀 Open Project Details &rarr;
                </Link>
                <Link
                  to="/uvcs"
                  className="btn-secondary"
                  id="dashboard-btn-demo-uvcs"
                >
                  🔍 Inspect UVCS &rarr;
                </Link>
              </div>
            </div>
          </section>
        )}

        {/* Live Project Statistics Section */}
        <section className="stats-section">
          <div className="section-title-row">
            <div>
              <h3>Project Portfolio Metrics</h3>
              <p>Aggregated directly from MongoDB project baselines.</p>
            </div>
            <Link to="/projects" className="btn-action-primary" id="dashboard-btn-projects">
              Manage Projects &rarr;
            </Link>
          </div>

          <div className="stats-grid">
            <div className="stat-card" id="stat-total-projects">
              <div className="stat-icon-wrapper blue">📁</div>
              <div className="stat-content">
                <span className="stat-label">Total Projects</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : projectStats.totalProjects}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-active-projects">
              <div className="stat-icon-wrapper green">⚡</div>
              <div className="stat-content">
                <span className="stat-label">Active Projects</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : projectStats.activeProjects}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-completed-projects">
              <div className="stat-icon-wrapper purple">🏁</div>
              <div className="stat-content">
                <span className="stat-label">Completed Projects</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : projectStats.completedProjects}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Live Software Version & Release Metrics Section */}
        <section className="stats-section">
          <div className="section-title-row">
            <div>
              <h3>Software Release & Version Metrics</h3>
              <p>Real-time lifecycle breakdown across all configuration baselines.</p>
            </div>
          </div>

          <div className="stats-grid stats-grid-4">
            <div className="stat-card" id="stat-total-versions">
              <div className="stat-icon-wrapper blue">🚀</div>
              <div className="stat-content">
                <span className="stat-label">Total Versions</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : versionStats.totalVersions}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-dev-versions">
              <div className="stat-icon-wrapper amber">🛠️</div>
              <div className="stat-content">
                <span className="stat-label">In Development</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : versionStats.development}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-qa-versions">
              <div className="stat-icon-wrapper indigo">🧪</div>
              <div className="stat-content">
                <span className="stat-label">In Testing / QA</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : versionStats.testing}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-released-versions">
              <div className="stat-icon-wrapper green">✅</div>
              <div className="stat-content">
                <span className="stat-label">Released</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : versionStats.released}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Phase 8: Live Release Governance Metrics */}
        <section className="stats-section">
          <div className="section-title-row">
            <div>
              <h3>Release Management & Deployment Metrics</h3>
              <p>Governance pipeline tracking application deployments from draft to production publishing.</p>
            </div>
          </div>

          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))' }}>
            <div className="stat-card" id="stat-total-releases">
              <div className="stat-icon-wrapper blue">📦</div>
              <div className="stat-content">
                <span className="stat-label">Total Releases</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : releaseStats.totalReleases}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-draft-releases">
              <div className="stat-icon-wrapper amber">📝</div>
              <div className="stat-content">
                <span className="stat-label">Draft</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : releaseStats.draftReleases}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-pending-approval-releases">
              <div className="stat-icon-wrapper purple">⏳</div>
              <div className="stat-content">
                <span className="stat-label">Pending Approval</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : releaseStats.pendingApproval}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-approved-releases">
              <div className="stat-icon-wrapper teal">👍</div>
              <div className="stat-content">
                <span className="stat-label">Approved</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : releaseStats.approvedReleases}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-published-releases">
              <div className="stat-icon-wrapper green">🚀</div>
              <div className="stat-content">
                <span className="stat-label">Published</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : releaseStats.publishedReleases}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Phase 8: Recent Releases Section */}
        <section className="recent-releases-section" style={{ marginBottom: '2.5rem' }}>
          <div className="section-title-row">
            <div>
              <h3>Recent Releases & Deployments</h3>
              <p>Latest application release baselines recorded in MongoDB.</p>
            </div>
          </div>

          {recentReleases.length === 0 ? (
            <div className="empty-state-card" id="empty-recent-releases" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                No releases published or created yet across projects.
              </p>
            </div>
          ) : (
            <div className="table-responsive card" id="recent-releases-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Release Name</th>
                    <th>Project</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Release Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReleases.map((rel) => (
                    <tr key={rel._id} className="recent-release-row">
                      <td>
                        <strong>{rel.releaseName}</strong>
                      </td>
                      <td>
                        {rel.project ? (
                          <span>
                            {rel.project.name} (<code>{rel.project.key}</code>)
                          </span>
                        ) : (
                          'Unknown Project'
                        )}
                      </td>
                      <td>
                        <span className="version-number-tag">
                          v{rel.version?.versionNumber || '1.0.0'}
                        </span>
                      </td>
                      <td>
                        <span className={`status-pill status-${rel.status}`}>
                          {releaseStatusLabels[rel.status] || rel.status}
                        </span>
                      </td>
                      <td>
                        <span className="date-text">
                          {rel.releaseDate
                            ? new Date(rel.releaseDate).toLocaleDateString()
                            : 'Immediate'}
                        </span>
                      </td>
                      <td>
                        {rel.project && (
                          <Link
                            to={`/projects/${rel.project._id}/releases/${rel._id}`}
                            className="btn-table-action"
                          >
                            View &rarr;
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Phase 13: Recent SCM Activity Stream */}
        <section className="recent-activity-section" style={{ marginBottom: '2.5rem' }}>
          <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <h3>Recent SCM Activity</h3>
              <p>Live chronological audit events recorded across projects in MongoDB.</p>
            </div>
            <Link to="/activity" className="btn btn-outline btn-sm" id="btn-view-all-activity">
              View All Activity &rarr;
            </Link>
          </div>

          {recentActivities.length === 0 ? (
            <div className="empty-state-card" id="empty-recent-activity" style={{ padding: '1.5rem', textAlign: 'center' }}>
              <p style={{ margin: 0, color: 'var(--text-muted)' }}>
                No recent activity recorded yet.
              </p>
            </div>
          ) : (
            <div className="card" id="recent-activity-card" style={{ padding: '0.75rem 1.25rem' }}>
              <div className="dashboard-activity-list">
                {recentActivities.map((act) => (
                  <div key={act._id} className="dashboard-activity-item">
                    <div className="dashboard-activity-icon">
                      {getActivityIcon(act.action)}
                    </div>
                    <div className="dashboard-activity-content">
                      <div className="dashboard-activity-desc">{act.description}</div>
                      <div className="dashboard-activity-meta">
                        <span className="dashboard-activity-actor">{act.actor?.name || 'User'}</span>
                        <span className="meta-dot">•</span>
                        {act.project && (
                          <>
                            <span className="dashboard-activity-project">{act.project.key}</span>
                            <span className="meta-dot">•</span>
                          </>
                        )}
                        <span className="dashboard-activity-time">{new Date(act.createdAt).toLocaleString()}</span>
                      </div>
                    </div>
                    <span className="dashboard-activity-badge">{act.entityType}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Phase 7: Live Bug Tracking Metrics */}
        <section className="stats-section">
          <div className="section-title-row">
            <div>
              <h3>Bug Tracking & Quality Metrics</h3>
              <p>Active defect backlog and resolution lifecycle tracking.</p>
            </div>
          </div>

          <div className="stats-grid stats-grid-4">
            <div className="stat-card" id="stat-total-bugs">
              <div className="stat-icon-wrapper red">🐛</div>
              <div className="stat-content">
                <span className="stat-label">Total Defects</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : bugStats.totalBugs}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-open-bugs">
              <div className="stat-icon-wrapper amber">⚠️</div>
              <div className="stat-content">
                <span className="stat-label">Open / Triage</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : bugStats.openBugs}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-inprogress-bugs">
              <div className="stat-icon-wrapper blue">⚙️</div>
              <div className="stat-content">
                <span className="stat-label">In Progress</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : bugStats.inProgressBugs}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-resolved-bugs">
              <div className="stat-icon-wrapper green">🎯</div>
              <div className="stat-content">
                <span className="stat-label">Resolved / Closed</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : (bugStats.resolvedBugs + bugStats.closedBugs)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* Phase 7: Live Change Request Metrics */}
        <section className="stats-section">
          <div className="section-title-row">
            <div>
              <h3>Change Request Governance Metrics</h3>
              <p>Formal change proposals, risk audits, and authorization pipeline.</p>
            </div>
          </div>

          <div className="stats-grid stats-grid-4">
            <div className="stat-card" id="stat-total-crs">
              <div className="stat-icon-wrapper purple">📝</div>
              <div className="stat-content">
                <span className="stat-label">Total Requests</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : crStats.totalCRs}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-pending-crs">
              <div className="stat-icon-wrapper amber">⏳</div>
              <div className="stat-content">
                <span className="stat-label">Pending Review</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : crStats.pendingCRs}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-approved-crs">
              <div className="stat-icon-wrapper green">👍</div>
              <div className="stat-content">
                <span className="stat-label">Approved</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : crStats.approvedCRs}
                </span>
              </div>
            </div>

            <div className="stat-card" id="stat-implemented-crs">
              <div className="stat-icon-wrapper teal">🚀</div>
              <div className="stat-content">
                <span className="stat-label">Implemented</span>
                <span className="stat-value">
                  {isLoadingStats ? <span className="stat-loading">...</span> : crStats.implementedCRs}
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* User Identity Profile Card */}
        <section className="profile-section">
          <div className="card profile-card">
            <div className="card-header">
              <h3>Authenticated User Profile</h3>
              <span className="status-pill status-active">Active Session</span>
            </div>
            <div className="card-body">
              <div className="profile-grid">
                <div className="profile-item">
                  <span className="label">Full Name</span>
                  <span className="value">{user?.name}</span>
                </div>
                <div className="profile-item">
                  <span className="label">Email Address</span>
                  <span className="value">{user?.email}</span>
                </div>
                <div className="profile-item">
                  <span className="label">Assigned Role</span>
                  <span className="value">
                    <span className={`role-badge role-${user?.role || 'developer'}`}>
                      {roleLabels[user?.role] || user?.role}
                    </span>
                  </span>
                </div>
                <div className="profile-item">
                  <span className="label">User ID (MongoDB)</span>
                  <span className="value code-val">{user?.id}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Architecture Roadmap Notice */}
        <section className="modules-overview">
          <div className="section-title">
            <h3>Configuration Management Roadmap</h3>
            <p>Phases 5 through 8 operational and verified with live MongoDB persistence:</p>
          </div>

          <div className="module-cards-grid">
            <div className="module-card active-module">
              <div className="module-icon">📁</div>
              <h4>Project & Portfolio</h4>
              <p>Multi-project workspace registration, membership, and baselines.</p>
              <span className="badge-active">Phase 5 - Active</span>
            </div>

            <div className="module-card active-module">
              <div className="module-icon">🚀</div>
              <h4>Releases & SemVer</h4>
              <p>Semantic version milestones, change records, and release lifecycle states.</p>
              <span className="badge-active">Phase 6 - Active</span>
            </div>

            <div className="module-card active-module">
              <div className="module-icon">📝</div>
              <h4>Change Requests (CRs)</h4>
              <p>Formal change proposals, risk evaluation, and approval boards.</p>
              <span className="badge-active">Phase 7 - Active</span>
            </div>

            <div className="module-card active-module">
              <div className="module-icon">🐛</div>
              <h4>Bug & Defect Tracking</h4>
              <p>Defect triage, reproduction steps, developer assignment, and resolution.</p>
              <span className="badge-active">Phase 7 - Active</span>
            </div>

            <div className="module-card active-module">
              <div className="module-icon">📊</div>
              <h4>Release Notes &amp; Governance</h4>
              <p>Release packaging, governance approvals, automated notes, and audit metrics.</p>
              <span className="badge-active">Phase 8 - Active</span>
            </div>

            <div className="module-card active-module">
              <div className="module-icon">📈</div>
              <h4>Reports &amp; SCM Analytics</h4>
              <p>System-wide metrics, defect quality analysis, release governance, and exportable analytics.</p>
              <span className="badge-active">Phase 9 - Active</span>
            </div>

            <div className="module-card active-module">
              <div className="module-icon">🔄</div>
              <h4>Unity Version Control (SCM)</h4>
              <p>Traceable changeset mapping, branches, and rollback history.</p>
              <span className="badge-active">Phase 10 - Active</span>
            </div>

            <div className="module-card active-module">
              <div className="module-icon">📜</div>
              <h4>Audit &amp; Activity System</h4>
              <p>Chronological SCM audit trails, actor attribution, and governance timelines.</p>
              <span className="badge-active">Phase 13 - Active</span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
