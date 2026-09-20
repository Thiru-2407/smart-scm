import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { projectService, versionService, bugService, changeRequestService, releaseService, auditService, traceabilityService, uvcsService } from '../services/api';

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
    case 'BASELINE_CREATED': return '🛡️';
    case 'BASELINE_FROZEN': return '❄️';
    case 'BASELINE_UPDATED':
    case 'BASELINE_DELETED': return '🛡️';
    default: return '📌';
  }
};

const Dashboard = () => {
  const { user, switchDemoRole } = useAuth();
  const [isSwitchingDemoRole, setIsSwitchingDemoRole] = useState(false);
  const [demoRoleFeedback, setDemoRoleFeedback] = useState('');

  const handleDashboardDemoRoleChange = async (e) => {
    const newRole = e.target.value;
    if (!newRole || newRole === user?.role) return;
    try {
      setIsSwitchingDemoRole(true);
      setDemoRoleFeedback('');
      const res = await switchDemoRole(newRole);
      if (res.success) {
        setDemoRoleFeedback(`Role changed to ${roleLabels[newRole] || newRole}`);
        setTimeout(() => setDemoRoleFeedback(''), 3500);
      }
    } catch (err) {
      alert(err.message || 'Failed to switch demo role');
    } finally {
      setIsSwitchingDemoRole(false);
    }
  };

  // Project statistics state
  const [projectStats, setProjectStats] = useState({
    totalProjects: 0,
    activeProjects: 0,
    completedProjects: 0,
    planningProjects: 0,
    archivedProjects: 0
  });

  // Version statistics state
  const [versionStats, setVersionStats] = useState({
    totalVersions: 0,
    development: 0,
    testing: 0,
    released: 0,
    deprecated: 0
  });

  // Bug statistics state
  const [bugStats, setBugStats] = useState({
    totalBugs: 0,
    openBugs: 0,
    inProgressBugs: 0,
    resolvedBugs: 0,
    closedBugs: 0,
    reopenedBugs: 0
  });

  // Change Request statistics state
  const [crStats, setCrStats] = useState({
    totalCRs: 0,
    pendingCRs: 0,
    approvedCRs: 0,
    implementedCRs: 0,
    rejectedCRs: 0,
    cancelledCRs: 0
  });

  // Release statistics state
  const [releaseStats, setReleaseStats] = useState({
    totalReleases: 0,
    draftReleases: 0,
    pendingApproval: 0,
    approvedReleases: 0,
    publishedReleases: 0,
    withdrawnReleases: 0
  });

  // Recent releases list
  const [recentReleases, setRecentReleases] = useState([]);
  // Recent activities list
  const [recentActivities, setRecentActivities] = useState([]);
  const [primaryProject, setPrimaryProject] = useState(null);

  // Traceability summary state
  const [traceabilitySummary, setTraceabilitySummary] = useState({
    totalChangeRequests: 0,
    linkedChangeRequests: 0,
    totalBugs: 0,
    linkedBugs: 0,
    totalVersions: 0,
    linkedVersions: 0,
    totalReleases: 0,
    linkedReleases: 0,
    coveragePercentage: 0
  });

  // UVCS Source Control state
  const [uvcsData, setUvcsData] = useState(null);
  const [uvcsWkChanges, setUvcsWkChanges] = useState(null);

  const [isLoadingStats, setIsLoadingStats] = useState(true);
  const [statsError, setStatsError] = useState('');

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoadingStats(true);
        setStatsError('');

        const [projRes, verRes, bugRes, crRes, relRes, recentRes, projsListRes, auditRes, traceRes, uvcsRes, uvcsWkRes] = await Promise.all([
          projectService.getProjectStats(),
          versionService.getVersionStats(),
          bugService.getBugStats(),
          changeRequestService.getChangeRequestStats(),
          releaseService.getReleaseStats(),
          releaseService.getRecentReleases(),
          projectService.getProjects(),
          auditService.getAuditLogs({ limit: 6 }).catch(() => ({ success: false, auditLogs: [] })),
          traceabilityService.getTraceability().catch(() => ({ success: false })),
          uvcsService.getStatus().catch(() => ({ success: false })),
          uvcsService.getWorkspaceChanges().catch(() => ({ success: false }))
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

        if (traceRes?.success && traceRes?.data?.summary) {
          setTraceabilitySummary(traceRes.data.summary);
        }

        if (uvcsRes?.success && uvcsRes?.data) {
          setUvcsData(uvcsRes.data);
        }

        if (uvcsWkRes?.success) {
          setUvcsWkChanges(uvcsWkRes);
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
        {/* 1. Page Title + Short One-Line Description */}
        <div className="page-header" style={{ marginBottom: '1.75rem' }}>
          <div>
            <h1 style={{ fontSize: '1.85rem', fontWeight: '700', margin: '0 0 0.25rem 0' }}>
              SCM Operations Dashboard
            </h1>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.92rem' }}>
              Real-time overview of projects, configuration baselines, version control, and release governance.
            </p>
          </div>
        </div>

        {/* Global Error Banner */}
        {statsError && (
          <div className="alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{statsError}</span>
          </div>
        )}

        {/* 2. Key SCM Statistics */}
        <section className="stats-section scm-analytics-summary" style={{ marginBottom: '2rem' }}>
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

        {/* 3. Current Project & Recent Releases Information */}
        {primaryProject && (
          <section className="card" style={{ marginBottom: '2rem', borderLeft: '4px solid var(--primary)', padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
                  <span className="project-key-tag large">{primaryProject.key}</span>
                  <span className="status-pill status-active">● Active</span>
                </div>
                <h3 style={{ fontSize: '1.35rem', fontWeight: '700', color: 'var(--text-main)', margin: '0 0 0.25rem 0' }}>
                  {primaryProject.name}
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
                  {primaryProject.description}
                </p>
              </div>

              <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
                <Link
                  to={`/projects/${primaryProject._id}`}
                  className="btn-action-primary"
                  id="dashboard-btn-demo-project"
                >
                  Open Project &rarr;
                </Link>
                <Link
                  to="/projects"
                  className="btn-secondary"
                  id="dashboard-btn-projects"
                >
                  Manage Projects &rarr;
                </Link>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
              <span><strong>Baseline Version:</strong> <span className="version-number-tag">v1.0.0</span></span>
              <span><strong>UVCS Changeset:</strong> <code style={{ background: '#f1f5f9', padding: '0.15rem 0.4rem', borderRadius: '4px' }}>cs:0@/main (default@local)</code></span>
              <span><strong>Active Releases:</strong> {releaseStats.totalReleases} total ({releaseStats.publishedReleases} published)</span>
            </div>
          </section>
        )}

        {/* Recent Releases Section */}
        {recentReleases.length > 0 && (
          <section style={{ marginBottom: '2rem' }}>
            <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0 }}>Recent Releases</h3>
            </div>

            <div className="table-responsive card" id="recent-releases-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Release</th>
                    <th>Project</th>
                    <th>Version</th>
                    <th>Status</th>
                    <th>Date</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentReleases.slice(0, 4).map((rel) => (
                    <tr key={rel._id} className="recent-release-row">
                      <td><strong>{rel.releaseName}</strong></td>
                      <td>{rel.project ? `${rel.project.name} (${rel.project.key})` : 'Smart SCM'}</td>
                      <td><span className="version-number-tag">v{rel.version?.versionNumber || '1.0.0'}</span></td>
                      <td><span className={`status-pill status-${rel.status}`}>{releaseStatusLabels[rel.status] || rel.status}</span></td>
                      <td><span className="date-text">{rel.releaseDate ? new Date(rel.releaseDate).toLocaleDateString() : 'Immediate'}</span></td>
                      <td>
                        {rel.project && (
                          <Link to={`/projects/${rel.project._id}/releases/${rel._id}`} className="btn-table-action">
                            View &rarr;
                          </Link>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* 4. Unity Version Control Status */}
        <section className="uvcs-dashboard-widget" style={{ marginBottom: '2rem' }}>
          <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Version Control Status</h3>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Link to="/baselines" className="btn btn-outline btn-sm" id="dashboard-btn-baselines">
                Baselines &rarr;
              </Link>
              <Link to="/uvcs" className="btn btn-primary btn-sm" id="dashboard-btn-uvcs">
                Open UVCS &rarr;
              </Link>
            </div>
          </div>

          <div className="card" id="dashboard-uvcs-card" style={{ padding: '1.25rem 1.5rem', background: '#f8fafc', borderLeft: '4px solid #4f46e5' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Engine Status</span>
                <span className={`status-pill ${uvcsData?.connected ? 'status-published' : 'status-deprecated'}`} style={{ marginTop: '0.25rem', display: 'inline-block' }}>
                  {uvcsData?.connected ? '🟢 Connected' : '○ Offline / Cloud'}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Repository</span>
                <code style={{ fontSize: '0.9rem', color: '#1e293b' }}>
                  {uvcsData?.repository?.spec || 'default@local'}
                </code>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Branch</span>
                <strong style={{ fontSize: '0.95rem', color: '#1e293b' }}>
                  {uvcsData?.branch || '/main'}
                </strong>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Head Changeset</span>
                <span className="status-pill status-in_progress" style={{ fontWeight: 700 }}>
                  cs:{uvcsData?.headChangeset?.changesetId !== undefined ? uvcsData.headChangeset.changesetId : 0}
                </span>
              </div>

              <div>
                <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, display: 'block' }}>Workspace</span>
                <span style={{ fontSize: '0.88rem', color: '#1e293b' }}>
                  <code>{uvcsData?.workspace?.name || 'smart_scm_wk'}</code> ({uvcsWkChanges?.count || 0} pending)
                </span>
              </div>
            </div>
          </div>
        </section>

        {/* 5. SCM Workflow / Traceability */}
        <section className="traceability-dashboard-widget" style={{ marginBottom: '2rem' }}>
          <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Traceability & Governance</h3>
            <Link to="/traceability" className="btn btn-outline btn-sm" id="btn-view-traceability">
              View Matrix &rarr;
            </Link>
          </div>

          <div className="card" id="dashboard-traceability-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.92rem', fontWeight: '600', color: 'var(--text-main)' }}>
                Baseline Lifecycle Alignment
              </span>
              <span style={{ fontSize: '1.25rem', fontWeight: '800', color: 'var(--primary)' }}>
                {isLoadingStats ? '...' : `${traceabilitySummary.coveragePercentage}%`}
              </span>
            </div>

            <div className="coverage-bar-track" style={{ background: '#e2e8f0', borderRadius: '8px', height: '10px', width: '100%', overflow: 'hidden', marginBottom: '1rem' }}>
              <div
                className="coverage-bar-fill"
                style={{
                  width: `${traceabilitySummary.coveragePercentage}%`,
                  height: '100%',
                  background: 'linear-gradient(90deg, #3b82f6, #10b981)',
                  transition: 'width 0.6s ease'
                }}
              />
            </div>

            <div className="traceability-stat-chips">
              <span className="trace-chip" id="trace-chip-crs">
                Linked CRs: <strong>{isLoadingStats ? '...' : `${traceabilitySummary.linkedChangeRequests} / ${traceabilitySummary.totalChangeRequests}`}</strong>
              </span>
              <span className="trace-chip" id="trace-chip-bugs">
                Linked Bugs: <strong>{isLoadingStats ? '...' : `${traceabilitySummary.linkedBugs} / ${traceabilitySummary.totalBugs}`}</strong>
              </span>
              <span className="trace-chip" id="trace-chip-versions">
                Linked Versions: <strong>{isLoadingStats ? '...' : `${traceabilitySummary.linkedVersions} / ${traceabilitySummary.totalVersions}`}</strong>
              </span>
              <span className="trace-chip" id="trace-chip-releases">
                Linked Releases: <strong>{isLoadingStats ? '...' : `${traceabilitySummary.linkedReleases} / ${traceabilitySummary.totalReleases}`}</strong>
              </span>
            </div>
          </div>

          {/* Compact Change Impact Analysis & Release Readiness */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '1rem' }}>
            <div className="card" id="dashboard-impact-card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: '1 1 200px' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '700' }}>Change Impact Analysis</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  View how a proposed change affects related bugs, versions, baselines and releases.
                </p>
              </div>
              <Link to="/impact-analysis" className="btn btn-outline btn-sm" id="dashboard-btn-impact-cta">
                Analyze Impact &rarr;
              </Link>
            </div>

            <div className="card" id="dashboard-readiness-card" style={{ padding: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ flex: '1 1 200px' }}>
                <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '1rem', fontWeight: '700' }}>Release Readiness</h4>
                <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                  Check whether a release satisfies the required SCM conditions.
                </p>
              </div>
              <Link to="/release-readiness" className="btn btn-outline btn-sm" id="dashboard-btn-readiness-cta">
                Check Readiness &rarr;
              </Link>
            </div>
          </div>
        </section>

        {/* 6. Recent Activity */}
        <section className="recent-activity-section" style={{ marginBottom: '2rem' }}>
          <div className="section-title-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <h3 style={{ margin: 0 }}>Recent Activity</h3>
            <Link to="/activity" className="btn btn-outline btn-sm" id="btn-view-all-activity">
              View All &rarr;
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
                {recentActivities.slice(0, 5).map((act) => (
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

        {/* 7. Quick Actions & Profile */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1.25rem', marginBottom: '2rem' }}>
          <div className="card" style={{ padding: '1.25rem 1.5rem' }}>
            <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem' }}>Quick Actions</h3>
            <div style={{ display: 'flex', gap: '0.65rem', flexWrap: 'wrap' }}>
              <Link to="/projects" className="btn btn-outline btn-sm">
                📁 Projects
              </Link>
              <Link to="/baselines" className="btn btn-outline btn-sm">
                🛡️ Baselines
              </Link>
              <Link to="/uvcs" className="btn btn-outline btn-sm">
                🔄 Version Control
              </Link>
              <Link to="/reports" className="btn btn-outline btn-sm" id="dashboard-btn-reports">
                📊 Reports
              </Link>
              {user?.role === 'admin' && (
                <Link to="/users" className="btn btn-primary btn-sm" id="dashboard-btn-manage-users">
                  👥 Manage Team
                </Link>
              )}
            </div>
          </div>

          <div className="card profile-card" style={{ padding: '1.25rem 1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.05rem' }}>User Session</h3>
              <span className={`role-badge role-${user?.role || 'developer'}`}>
                {roleLabels[user?.role] || user?.role}
              </span>
            </div>
            <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)' }}>
              <div><strong style={{ color: 'var(--text-main)' }}>{user?.name}</strong></div>
              <div>{user?.email}</div>
            </div>

            {user && user.role !== 'admin' && (
              <div className="dashboard-demo-role-section" id="dashboard-demo-role-section" style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--primary)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Demo Role Switch
                  </span>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Demonstration / Testing</span>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <select
                    id="dashboard-demo-role-select"
                    value={user.role}
                    onChange={handleDashboardDemoRoleChange}
                    disabled={isSwitchingDemoRole}
                    style={{ flex: 1, fontSize: '0.85rem', padding: '0.35rem 0.6rem', borderRadius: '4px', border: '1px solid var(--border-color)', background: '#fff' }}
                  >
                    <option value="project_manager">Project Manager</option>
                    <option value="developer">Developer</option>
                    <option value="tester">QA / Tester</option>
                  </select>
                </div>
                {demoRoleFeedback && (
                  <div style={{ marginTop: '0.35rem', fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>
                    ✓ {demoRoleFeedback}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Dashboard;
