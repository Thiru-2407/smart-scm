import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { impactService, projectService } from '../services/api';

const statusBadgeColors = {
  submitted: 'status-pending',
  under_review: 'status-review',
  approved: 'status-active',
  implemented: 'status-success',
  rejected: 'status-rejected',
  cancelled: 'status-inactive',
  open: 'status-rejected',
  in_progress: 'status-review',
  resolved: 'status-success',
  closed: 'status-inactive',
  development: 'status-pending',
  testing: 'status-review',
  released: 'status-success',
  deprecated: 'status-inactive',
  draft: 'status-pending',
  pending_approval: 'status-review',
  published: 'status-success',
  withdrawn: 'status-rejected'
};

const levelColors = {
  LOW: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', badgeClass: 'impact-badge-low' },
  MEDIUM: { bg: '#fefce8', text: '#854d0e', border: '#fde047', badgeClass: 'impact-badge-medium' },
  HIGH: { bg: '#fff7ed', text: '#9a3412', border: '#fdba74', badgeClass: 'impact-badge-high' },
  CRITICAL: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', badgeClass: 'impact-badge-critical' }
};

const ImpactAnalysis = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const crQueryParam = searchParams.get('changeRequest') || '';
  const projectQueryParam = searchParams.get('project') || '';

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectQueryParam);
  const [changeRequests, setChangeRequests] = useState([]);
  const [selectedCRId, setSelectedCRId] = useState(crQueryParam);

  const [impactData, setImpactData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // Load projects list and CR list
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch accessible projects
        const projRes = await projectService.getProjects();
        if (isMounted) {
          const projs = projRes.data || [];
          setProjects(projs);
        }

        // Fetch CR list and optional selected impact
        const params = {};
        if (selectedProjectId) params.project = selectedProjectId;
        if (selectedCRId) params.changeRequest = selectedCRId;

        const res = await impactService.getImpactAnalysis(params);
        if (isMounted) {
          if (res.success && res.data) {
            setChangeRequests(res.data.changeRequests || []);
            if (res.data.selectedImpact) {
              setImpactData(res.data.selectedImpact);
            } else if (!selectedCRId && res.data.changeRequests && res.data.changeRequests.length > 0) {
              // Auto-select first CR if none specified
              const firstCr = res.data.changeRequests[0];
              setSelectedCRId(firstCr.id);
              loadCRImpact(firstCr.id);
            } else {
              setImpactData(null);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load impact analysis data.');
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, [selectedProjectId]);

  // When selectedCRId changes from user or URL
  useEffect(() => {
    if (selectedCRId) {
      loadCRImpact(selectedCRId);
    } else {
      setImpactData(null);
    }
  }, [selectedCRId]);

  const loadCRImpact = async (crId) => {
    try {
      setIsLoadingDetail(true);
      setError(null);
      const res = await impactService.getChangeRequestImpact(crId);
      if (res.success && res.data) {
        setImpactData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load change request impact details.');
      setImpactData(null);
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSelectCR = (crId) => {
    setSelectedCRId(crId);
    const newParams = new URLSearchParams(searchParams);
    if (crId) {
      newParams.set('changeRequest', crId);
    } else {
      newParams.delete('changeRequest');
    }
    setSearchParams(newParams);
  };

  const handleProjectFilter = (projId) => {
    setSelectedProjectId(projId);
    setSelectedCRId('');
    setImpactData(null);
    const newParams = new URLSearchParams();
    if (projId) newParams.set('project', projId);
    setSearchParams(newParams);
  };

  const handleResetFilters = () => {
    setSelectedProjectId('');
    setSelectedCRId('');
    setImpactData(null);
    setSearchParams(new URLSearchParams());
  };

  const currentLevel = impactData?.summary?.impactLevel || 'LOW';
  const levelStyle = levelColors[currentLevel] || levelColors.LOW;

  return (
    <div className="page-layout">
      <Navbar />

      <main className="main-content" id="impact-analysis-page">
        {/* Step 9: Header */}
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <div className="traceability-eyebrow">
              CONFIGURATION MANAGEMENT • SCM IMPACT ANALYSIS
            </div>
            <h1 id="impact-page-title" style={{ fontSize: '1.85rem', fontWeight: '700', margin: '0.2rem 0' }}>
              Change Impact Analysis
            </h1>
            <p id="impact-page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
              Analyze downstream configuration items affected by a software change.
            </p>
          </div>
        </div>

        {/* Informational Card */}
        <div className="card" id="impact-info-card" style={{ marginBottom: '1.75rem', background: '#f8fafc', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>ℹ️</span>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
              Impact analysis helps identify which bugs, versions, source-control baselines, and releases may be affected by a change.
              All evaluations are computed strictly from verified configuration management relationships in MongoDB and UVCS metadata.
            </p>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Step 10: Selector & Filter Bar */}
        <section className="card filter-bar-card" id="impact-filter-card" style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem' }}>
          <div className="filter-controls-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            {/* Project Filter */}
            <div className="filter-field">
              <label htmlFor="filter-project" className="filter-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                Project
              </label>
              <select
                id="filter-project"
                className="form-select"
                value={selectedProjectId}
                onChange={(e) => handleProjectFilter(e.target.value)}
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

            {/* Change Request Selector */}
            <div className="filter-field">
              <label htmlFor="select-change-request" className="filter-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                Select Change Request
              </label>
              <select
                id="select-change-request"
                className="form-select"
                value={selectedCRId}
                onChange={(e) => handleSelectCR(e.target.value)}
                disabled={isLoading || changeRequests.length === 0}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              >
                {changeRequests.length === 0 ? (
                  <option value="">No Change Requests Available</option>
                ) : (
                  <>
                    <option value="">-- Choose a Change Request --</option>
                    {changeRequests.map((cr) => (
                      <option key={cr.id} value={cr.id}>
                        [{cr.key}] {cr.title} ({cr.impactLevel})
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Reset Action */}
            <div className="filter-actions" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-outline"
                id="btn-reset-impact"
                style={{ width: '100%', height: '38px', whiteSpace: 'nowrap' }}
              >
                Reset Selection
              </button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ marginBottom: '1rem' }}></div>
            Loading configuration data from MongoDB...
          </div>
        ) : changeRequests.length === 0 ? (
          <div className="empty-state-card card" style={{ padding: '3.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📝</div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '700' }}>No Change Requests Found</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
              No Change Requests were found in the selected scope. Select another project or create a Change Request to evaluate downstream configuration impact.
            </p>
            <button onClick={handleResetFilters} className="btn btn-primary btn-sm">
              Reset Filters
            </button>
          </div>
        ) : !impactData ? (
          <div className="empty-state-card card" style={{ padding: '3.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎯</div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '700' }}>Select a Change Request to Analyze</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
              Choose a Change Request from the selector above to trace and calculate its downstream SCM configuration impact.
            </p>
          </div>
        ) : (
          <>
            {/* Step 11: Impact Score Card */}
            <section className="card impact-score-card" id="impact-score-card" style={{ marginBottom: '2rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>
                    IMPACT LEVEL
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                    <span
                      id="impact-level-badge"
                      className={`impact-badge-lg ${levelStyle.badgeClass}`}
                      style={{
                        fontSize: '1.4rem',
                        fontWeight: '800',
                        padding: '0.35rem 1rem',
                        borderRadius: '8px',
                        background: levelStyle.bg,
                        color: levelStyle.text,
                        border: `1.5px solid ${levelStyle.border}`,
                        letterSpacing: '0.05em'
                      }}
                    >
                      {impactData.summary.impactLevel}
                    </span>
                    <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Based on linked configuration artifacts
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <Link
                    to={`/projects/${impactData.changeRequest.project?._id || impactData.changeRequest.project}/change-requests/${impactData.changeRequest.id}`}
                    className="btn btn-outline btn-sm"
                    id="btn-view-cr-details"
                  >
                    View Change Request Details &rarr;
                  </Link>
                </div>
              </div>

              {/* Dynamic Artifact Counters */}
              <div className="impact-counts-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                <div className="impact-count-card" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Defects / Bugs</div>
                  <div id="impact-count-bugs" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#ef4444' }}>
                    {isLoadingDetail ? '...' : impactData.summary.impactedBugs}
                  </div>
                </div>

                <div className="impact-count-card" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Target Versions</div>
                  <div id="impact-count-versions" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#f59e0b' }}>
                    {isLoadingDetail ? '...' : impactData.summary.impactedVersions}
                  </div>
                </div>

                <div className="impact-count-card" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>UVCS Baselines</div>
                  <div id="impact-count-baselines" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#6366f1' }}>
                    {isLoadingDetail ? '...' : impactData.summary.impactedBaselines}
                  </div>
                </div>

                <div className="impact-count-card" style={{ padding: '1rem', background: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', textAlign: 'center' }}>
                  <div style={{ fontSize: '0.78rem', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '0.25rem' }}>Affected Releases</div>
                  <div id="impact-count-releases" style={{ fontSize: '1.8rem', fontWeight: '800', color: '#10b981' }}>
                    {isLoadingDetail ? '...' : impactData.summary.impactedReleases}
                  </div>
                </div>
              </div>

              {/* Step 17: Configuration Impact Explanation */}
              <div className="impact-explanation-box" id="impact-explanation" style={{ padding: '1rem 1.25rem', background: '#f1f5f9', borderRadius: '8px', borderLeft: '4px solid #64748b' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '700', textTransform: 'uppercase', color: '#475569', marginBottom: '0.25rem' }}>
                  SCM Configuration Impact Assessment
                </div>
                <p style={{ margin: 0, fontSize: '0.92rem', color: '#1e293b', lineHeight: 1.5 }}>
                  {impactData.summary.explanation}
                </p>
              </div>
            </section>

            {/* Step 12: Visual Impact Graph */}
            <section className="card visual-graph-card" id="impact-visual-graph" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
              <div className="card-header" style={{ padding: '0 0 1.25rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.2rem 0' }}>
                    Visual Configuration Impact Propagation Chain
                  </h3>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                    5-Stage SCM Lifecycle Traversal from Source Change Proposal to Production Deliverables
                  </p>
                </div>
              </div>

              <div className="impact-chain-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {/* Stage 1: Change Request */}
                <div className="impact-node-card node-cr" style={{ border: '1.5px solid #a855f7', borderRadius: '8px', padding: '1rem', background: '#faf5ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#7e22ce' }}>STAGE 1: SOURCE CHANGE REQUEST</span>
                    <span className={`status-pill ${statusBadgeColors[impactData.changeRequest.status] || 'status-pending'}`}>
                      {impactData.changeRequest.status}
                    </span>
                  </div>
                  <div style={{ fontSize: '1rem', fontWeight: '700', color: '#1e1b4b' }}>
                    <span className="matrix-code-badge" style={{ marginRight: '0.5rem' }}>{impactData.changeRequest.key}</span>
                    {impactData.changeRequest.title}
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#6b21a8', marginTop: '0.35rem' }}>
                    Priority: <strong>{impactData.changeRequest.priority}</strong> • Relationship: <strong>Source</strong>
                  </div>
                </div>

                <div className="chain-connector" style={{ textAlign: 'center', fontSize: '1.25rem', color: '#94a3b8', lineHeight: 1 }}>↓</div>

                {/* Stage 2: Affected Bugs */}
                <div className="impact-node-card node-bugs" style={{ border: '1.5px solid #f87171', borderRadius: '8px', padding: '1rem', background: '#fef2f2' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#b91c1c' }}>STAGE 2: AFFECTED BUGS / DEFECTS</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#b91c1c' }}>
                      {impactData.impacts.bugs.length} {impactData.impacts.bugs.length === 1 ? 'Defect' : 'Defects'}
                    </span>
                  </div>
                  {impactData.impacts.bugs.length === 0 ? (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No linked bugs or defects recorded for this change proposal.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {impactData.impacts.bugs.map((b) => (
                        <div key={b.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                          <div>
                            <span className="matrix-code-badge" style={{ marginRight: '0.4rem' }}>{b.key}</span>
                            <strong>{b.title}</strong>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <span className={`status-pill ${statusBadgeColors[b.status] || 'status-pending'}`}>{b.status}</span>
                            <span className="severity-badge" style={{ fontSize: '0.72rem', padding: '0.1rem 0.35rem' }}>{b.severity}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="chain-connector" style={{ textAlign: 'center', fontSize: '1.25rem', color: '#94a3b8', lineHeight: 1 }}>↓</div>

                {/* Stage 3: Affected Version */}
                <div className="impact-node-card node-version" style={{ border: '1.5px solid #facc15', borderRadius: '8px', padding: '1rem', background: '#fefce8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#854d0e' }}>STAGE 3: TARGET / AFFECTED VERSION</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#854d0e' }}>
                      {impactData.impacts.versions.length} {impactData.impacts.versions.length === 1 ? 'Version' : 'Versions'}
                    </span>
                  </div>
                  {impactData.impacts.versions.length === 0 ? (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No target or derived version linked to this change request.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {impactData.impacts.versions.map((v) => (
                        <div key={v.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem' }}>
                          <div>
                            <span className="version-number-tag" style={{ marginRight: '0.5rem' }}>v{v.versionNumber}</span>
                            <strong>{v.name}</strong>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span className={`status-pill ${statusBadgeColors[v.status] || 'status-pending'}`}>{v.status}</span>
                            <span className={`relation-badge ${v.relationshipType === 'DIRECT' ? 'relation-direct' : 'relation-derived'}`} style={{ fontSize: '0.72rem' }}>
                              {v.relationshipType}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="chain-connector" style={{ textAlign: 'center', fontSize: '1.25rem', color: '#94a3b8', lineHeight: 1 }}>↓</div>

                {/* Stage 4: UVCS Baseline */}
                <div className="impact-node-card node-uvcs" style={{ border: '1.5px solid #818cf8', borderRadius: '8px', padding: '1rem', background: '#eef2ff' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#3730a3' }}>STAGE 4: UNITY VERSION CONTROL BASELINE</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#3730a3' }}>
                      {impactData.impacts.baselines.length} {impactData.impacts.baselines.length === 1 ? 'Baseline' : 'Baselines'}
                    </span>
                  </div>
                  {impactData.impacts.baselines.length === 0 ? (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      No UVCS changeset baseline anchored to the affected version.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {impactData.impacts.baselines.map((b, idx) => (
                        <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <code style={{ background: '#e0e7ff', padding: '0.2rem 0.5rem', borderRadius: '4px', fontWeight: '700', color: '#312e81' }}>
                              cs:{b.changesetId}
                            </code>
                            <span style={{ color: '#4338ca' }}>Branch: <strong>{b.branch}</strong></span>
                            <span style={{ color: '#6366f1', fontSize: '0.8rem' }}>({b.repository})</span>
                          </div>
                          <span className="relation-badge relation-direct" style={{ fontSize: '0.72rem' }}>
                            DIRECT
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="chain-connector" style={{ textAlign: 'center', fontSize: '1.25rem', color: '#94a3b8', lineHeight: 1 }}>↓</div>

                {/* Stage 5: Affected Releases */}
                <div className="impact-node-card node-releases" style={{ border: '1.5px solid #34d399', borderRadius: '8px', padding: '1rem', background: '#ecfdf5' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: '#065f46' }}>STAGE 5: AFFECTED RELEASES</span>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#065f46' }}>
                      {impactData.impacts.releases.length} {impactData.impacts.releases.length === 1 ? 'Release' : 'Releases'}
                    </span>
                  </div>
                  {impactData.impacts.releases.length === 0 ? (
                    <div style={{ fontSize: '0.88rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Not linked to any downstream release deliverables.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {impactData.impacts.releases.map((r) => (
                        <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.88rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                          <div>
                            <strong>{r.releaseName}</strong>
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginLeft: '0.5rem' }}>
                              ({r.relationshipSource})
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                            <span className={`status-pill ${statusBadgeColors[r.status] || 'status-pending'}`}>{r.status}</span>
                            <span className={`relation-badge ${r.relationshipType === 'DIRECT' ? 'relation-direct' : 'relation-derived'}`} style={{ fontSize: '0.72rem' }}>
                              {r.relationshipType}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </section>

            {/* Step 13: Impacted Artifact Table */}
            <section className="card table-card" id="impacted-artifacts-card" style={{ marginBottom: '2rem', padding: 0, overflow: 'hidden' }}>
              <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
                  Impacted Artifact Inventory ({impactData.artifactTable?.length || 0} Items)
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Click artifact link to view details
                </span>
              </div>

              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="data-table" id="impacted-artifacts-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '220px' }}>Artifact</th>
                      <th style={{ minWidth: '130px' }}>Type</th>
                      <th style={{ minWidth: '160px' }}>Relationship</th>
                      <th style={{ minWidth: '120px' }}>Status</th>
                      <th style={{ minWidth: '100px' }}>Impact</th>
                    </tr>
                  </thead>
                  <tbody>
                    {impactData.artifactTable?.map((item, index) => (
                      <tr key={index}>
                        {/* Artifact Name / Link */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            {item.url ? (
                              <Link to={item.url} className="matrix-entity-link" style={{ fontWeight: '600' }}>
                                {item.code && <span className="matrix-code-badge">{item.code}</span>}
                                <span>{item.artifact}</span>
                              </Link>
                            ) : (
                              <div>
                                {item.code && <span className="matrix-code-badge">{item.code}</span>}
                                <span>{item.artifact}</span>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Type */}
                        <td>
                          <span style={{ fontSize: '0.85rem', fontWeight: '600', color: 'var(--text-main)' }}>
                            {item.type}
                          </span>
                        </td>

                        {/* Relationship (with Direct vs Derived tag) */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span style={{ fontSize: '0.85rem' }}>{item.relationship}</span>
                            <span className={`relation-badge ${item.relationshipType === 'DIRECT' ? 'relation-direct' : 'relation-derived'}`} style={{ fontSize: '0.7rem' }}>
                              {item.relationshipType}
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td>
                          <span className={`status-pill ${statusBadgeColors[item.status] || 'status-pending'}`}>
                            {item.status}
                          </span>
                        </td>

                        {/* Impact */}
                        <td>
                          <span
                            style={{
                              fontSize: '0.8rem',
                              fontWeight: '700',
                              color: item.impact === 'Source' ? '#7e22ce' : '#b91c1c'
                            }}
                          >
                            {item.impact}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Step 14: Direct vs Derived Legend */}
            <section className="card legend-card" id="impact-legend-card" style={{ padding: '1.25rem 1.5rem', marginBottom: '2.5rem', background: '#f8fafc' }}>
              <h4 style={{ fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                SCM Relationship Legend &amp; Traceability Methodology
              </h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span className="relation-badge relation-direct" style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>DIRECT</span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    <strong>Explicit DB link:</strong> Direct reference stored in MongoDB (e.g. <code>cr.targetVersion</code>, <code>bug.changeRequest</code>).
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span className="relation-badge relation-derived" style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>DERIVED</span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    <strong>Inferred connection:</strong> Linked through an intermediate artifact (e.g. Release referencing a defect).
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '0.6rem', alignItems: 'flex-start' }}>
                  <span className="not-linked-badge" style={{ fontSize: '0.75rem', marginTop: '0.15rem' }}>NOT LINKED</span>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
                    <strong>Unlinked stage:</strong> No explicit or indirect relationship exists in the database.
                  </div>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default ImpactAnalysis;
