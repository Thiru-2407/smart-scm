import { useState, useEffect, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { readinessService, projectService } from '../services/api';

const statusBadgeColors = {
  PASS: { bg: '#ecfdf5', text: '#065f46', border: '#a7f3d0', icon: '✓', class: 'status-badge-pass' },
  WARNING: { bg: '#fefce8', text: '#854d0e', border: '#fde047', icon: '⚠️', class: 'status-badge-warning' },
  FAIL: { bg: '#fef2f2', text: '#991b1b', border: '#fca5a5', icon: '❌', class: 'status-badge-fail' },
  NOT_APPLICABLE: { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1', icon: '—', class: 'status-badge-na' }
};

const levelStyles = {
  READY: {
    bg: '#ecfdf5',
    text: '#065f46',
    border: '#10b981',
    label: 'READY FOR PUBLICATION',
    icon: '✅',
    badgeClass: 'level-ready'
  },
  CONDITIONALLY_READY: {
    bg: '#fffbeb',
    text: '#92400e',
    border: '#f59e0b',
    label: 'CONDITIONALLY READY',
    icon: '⚠️',
    badgeClass: 'level-conditional'
  },
  NOT_READY: {
    bg: '#fef2f2',
    text: '#991b1b',
    border: '#ef4444',
    label: 'NOT READY (BLOCKED)',
    icon: '🛑',
    badgeClass: 'level-not-ready'
  }
};

const ReleaseReadiness = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const releaseParam = searchParams.get('release') || '';
  const projectParam = searchParams.get('project') || '';

  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(projectParam);
  const [releases, setReleases] = useState([]);
  const [selectedReleaseId, setSelectedReleaseId] = useState(releaseParam);

  const [readinessData, setReadinessData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [error, setError] = useState(null);

  // Synchronize state when URL query params change
  useEffect(() => {
    const rel = searchParams.get('release') || '';
    if (rel && rel !== selectedReleaseId) {
      setSelectedReleaseId(rel);
    }
    const proj = searchParams.get('project') || '';
    if (proj && proj !== selectedProjectId) {
      setSelectedProjectId(proj);
    }
  }, [searchParams]);

  const loadReleaseReadinessDetail = useCallback(async (relId) => {
    try {
      setIsLoadingDetail(true);
      setError(null);
      const res = await readinessService.getReleaseReadinessByRelease(relId);
      if (res.success && res.data) {
        setReadinessData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to evaluate release readiness.');
      setReadinessData(null);
    } finally {
      setIsLoadingDetail(false);
    }
  }, []);

  // Load project list and accessible releases
  useEffect(() => {
    let isMounted = true;

    const loadInitialData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const projRes = await projectService.getProjects();
        if (isMounted) {
          setProjects(projRes.projects || projRes.data || []);
        }

        const params = {};
        if (selectedProjectId) params.project = selectedProjectId;
        if (selectedReleaseId) params.release = selectedReleaseId;

        const res = await readinessService.getReleaseReadiness(params);
        if (isMounted) {
          if (res.success && res.data) {
            setReleases(res.data.releases || []);
            if (res.data.selectedReadiness) {
              setReadinessData(res.data.selectedReadiness);
            } else if (!selectedReleaseId && res.data.releases && res.data.releases.length > 0) {
              const firstRel = res.data.releases[0];
              setSelectedReleaseId(firstRel.id);
            } else if (!selectedReleaseId) {
              setReadinessData(null);
            }
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load release readiness data.');
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

  // Load details when selectedReleaseId changes
  useEffect(() => {
    if (selectedReleaseId) {
      loadReleaseReadinessDetail(selectedReleaseId);
    } else {
      setReadinessData(null);
    }
  }, [selectedReleaseId, loadReleaseReadinessDetail]);

  const handleSelectRelease = (relId) => {
    setSelectedReleaseId(relId);
    const newParams = new URLSearchParams(searchParams);
    if (relId) {
      newParams.set('release', relId);
    } else {
      newParams.delete('release');
    }
    setSearchParams(newParams);
  };

  const handleProjectFilter = (projId) => {
    setSelectedProjectId(projId);
    setSelectedReleaseId('');
    setReadinessData(null);
    const newParams = new URLSearchParams();
    if (projId) newParams.set('project', projId);
    setSearchParams(newParams);
  };

  const handleRefresh = () => {
    if (selectedReleaseId) {
      loadReleaseReadinessDetail(selectedReleaseId);
    }
  };

  const handleResetFilters = () => {
    setSelectedProjectId('');
    setSelectedReleaseId('');
    setReadinessData(null);
    setSearchParams(new URLSearchParams());
  };

  const currentLevel = readinessData?.readiness?.level || 'NOT_READY';
  const levelMeta = levelStyles[currentLevel] || levelStyles.NOT_READY;

  return (
    <div className="page-layout">
      <Navbar />

      <main className="main-content" id="release-readiness-page">
        {/* Step 8 & 9: Header */}
        <div className="page-header" style={{ marginBottom: '1.5rem' }}>
          <div>
            <div className="traceability-eyebrow">
              CONFIGURATION MANAGEMENT • SCM RELEASE GOVERNANCE
            </div>
            <h1 id="readiness-page-title" style={{ fontSize: '1.85rem', fontWeight: '700', margin: '0.2rem 0' }}>
              SCM Release Readiness &amp; Governance
            </h1>
            <p id="readiness-page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: 0 }}>
              Verify configuration governance, unresolved defects, baselines, and approvals before publishing a release.
            </p>
          </div>
        </div>

        {/* Informational Card */}
        <div className="card" id="readiness-info-card" style={{ marginBottom: '1.75rem', background: '#f8fafc', borderLeft: '4px solid var(--primary)' }}>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.25rem', lineHeight: 1 }}>🛡️</span>
            <p style={{ margin: 0, fontSize: '0.9rem', color: '#334155', lineHeight: 1.5 }}>
              <strong>SCM Configuration Readiness:</strong> Evaluates version configuration, defect resolution state, change-request governance, bi-directional traceability, UVCS baseline linkage, release notes, and administrative approvals. This assesses configuration management integrity, not runtime QA perfection.
            </p>
          </div>
        </div>

        {/* Global Error Banner */}
        {error && (
          <div className="alert alert-danger" style={{ marginBottom: '1.5rem' }}>
            <span>⚠️ {error}</span>
          </div>
        )}

        {/* Step 8: Selector Bar */}
        <section className="card filter-bar-card" id="readiness-controls-card" style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem' }}>
          <div className="filter-controls-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', alignItems: 'end' }}>
            {/* Project Filter */}
            <div className="filter-field">
              <label htmlFor="select-readiness-project" className="filter-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                Project
              </label>
              <select
                id="select-readiness-project"
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

            {/* Release Selector */}
            <div className="filter-field">
              <label htmlFor="select-readiness-release" className="filter-label" style={{ display: 'block', fontSize: '0.82rem', fontWeight: '600', marginBottom: '0.35rem', color: 'var(--text-muted)' }}>
                Select Release Package
              </label>
              <select
                id="select-readiness-release"
                className="form-select"
                value={selectedReleaseId}
                onChange={(e) => handleSelectRelease(e.target.value)}
                disabled={isLoading || releases.length === 0}
                style={{ width: '100%', padding: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              >
                {releases.length === 0 ? (
                  <option value="">No Releases Available</option>
                ) : (
                  <>
                    <option value="">-- Choose a Release --</option>
                    {releases.map((rel) => (
                      <option key={rel.id} value={rel.id}>
                        {rel.releaseName} ({rel.version}) — Score: {rel.score}% [{rel.readinessLevel.replace(/_/g, ' ')}]
                      </option>
                    ))}
                  </>
                )}
              </select>
            </div>

            {/* Actions */}
            <div className="filter-actions" style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleRefresh}
                className="btn btn-outline"
                id="btn-refresh-readiness"
                disabled={isLoading || !selectedReleaseId}
                style={{ height: '38px', whiteSpace: 'nowrap' }}
              >
                🔄 Refresh
              </button>
              <button
                type="button"
                onClick={handleResetFilters}
                className="btn btn-outline"
                id="btn-reset-readiness"
                style={{ height: '38px', whiteSpace: 'nowrap' }}
              >
                Reset
              </button>
            </div>
          </div>
        </section>

        {isLoading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div className="spinner" style={{ marginBottom: '1rem' }}></div>
            Auditing release governance from MongoDB...
          </div>
        ) : releases.length === 0 ? (
          <div className="empty-state-card card" style={{ padding: '3.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>📦</div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '700' }}>No Releases Found</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
              No releases are currently registered in the selected project scope. Create a release milestone to perform SCM readiness gatekeeping.
            </p>
            <button onClick={handleResetFilters} className="btn btn-primary btn-sm">
              Reset Filters
            </button>
          </div>
        ) : !readinessData ? (
          <div className="empty-state-card card" style={{ padding: '3.5rem', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>🎯</div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontWeight: '700' }}>Select a Release to Audit</h3>
            <p style={{ color: 'var(--text-muted)', maxWidth: '460px', margin: '0 auto 1.5rem auto' }}>
              Choose a release from the dropdown selector above to calculate its SCM governance score, inspect blockers, and view the release pipeline.
            </p>
          </div>
        ) : (
          <>
            {/* Step 10: Score Visualization Card */}
            <section className="card readiness-score-card" id="readiness-score-card" style={{ marginBottom: '2rem', padding: '1.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1.5rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '1.5rem', marginBottom: '1.5rem' }}>
                <div>
                  <div style={{ fontSize: '0.8rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: '0.35rem' }}>
                    SCM RELEASE READINESS EVALUATION
                  </div>
                  <h2 style={{ margin: '0 0 0.5rem 0', fontSize: '1.4rem', fontWeight: '800', color: 'var(--text-main)' }}>
                    {readinessData.release.releaseName}
                  </h2>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                    <span
                      id="readiness-level-badge"
                      className={`readiness-level-pill ${levelMeta.badgeClass}`}
                      style={{
                        fontSize: '1rem',
                        fontWeight: '800',
                        padding: '0.35rem 0.9rem',
                        borderRadius: '6px',
                        background: levelMeta.bg,
                        color: levelMeta.text,
                        border: `1.5px solid ${levelMeta.border}`,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '0.4rem'
                      }}
                    >
                      <span>{levelMeta.icon}</span>
                      <span>{levelMeta.label}</span>
                    </span>

                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                      Version: <strong>v{readinessData.release.version?.versionNumber || 'None'}</strong> • Status: <strong>{readinessData.release.status}</strong>
                    </span>
                  </div>
                </div>

                {/* Circular / Large Score Display */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem', background: '#f8fafc', padding: '1rem 1.5rem', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Readiness Score</div>
                    <div id="readiness-score-value" style={{ fontSize: '2.4rem', fontWeight: '900', color: currentLevel === 'READY' ? '#10b981' : currentLevel === 'CONDITIONALLY_READY' ? '#f59e0b' : '#ef4444', lineHeight: 1.1 }}>
                      {isLoadingDetail ? '...' : `${readinessData.score} / 100`}
                    </div>
                  </div>
                </div>
              </div>

              {/* Summary Counts Bar */}
              <div id="readiness-summary-counts" style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', alignItems: 'center', fontSize: '0.88rem' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#065f46', fontWeight: '700' }}>
                  <span>✓</span> {readinessData.summary.passed} Passed
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#854d0e', fontWeight: '700' }}>
                  <span>⚠️</span> {readinessData.summary.warnings} Warnings
                </span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', color: '#991b1b', fontWeight: '700' }}>
                  <span>❌</span> {readinessData.summary.failed} Failed
                </span>
                <span style={{ color: 'var(--text-muted)', marginLeft: 'auto', fontStyle: 'italic', fontSize: '0.82rem' }}>
                  Based on weighted SCM configuration policies
                </span>
              </div>
            </section>

            {/* Step 6: Blocking Conditions Callout */}
            <section className="card blockers-card" id="readiness-blockers-section" style={{ marginBottom: '2rem', padding: '1.25rem 1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                <span style={{ fontSize: '1.1rem' }}>{readinessData.blockers.length > 0 ? '🛑' : '✅'}</span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: '700' }}>
                  BLOCKING CONDITIONS ({readinessData.blockers.length})
                </h3>
              </div>

              {readinessData.blockers.length === 0 ? (
                <div className="alert alert-success" style={{ margin: 0, padding: '0.85rem 1.25rem', background: '#ecfdf5', color: '#065f46', border: '1px solid #a7f3d0', borderRadius: '6px' }}>
                  ✓ No blocking conditions detected. Release satisfies minimum mandatory SCM governance criteria.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {readinessData.blockers.map((b, idx) => (
                    <div
                      key={idx}
                      className="blocker-item"
                      style={{
                        padding: '0.75rem 1rem',
                        background: '#fef2f2',
                        color: '#991b1b',
                        borderLeft: '4px solid #ef4444',
                        borderRadius: '4px',
                        fontSize: '0.88rem',
                        fontWeight: '600'
                      }}
                    >
                      ❌ {b}
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Step 11: Governance Pipeline Visual Flow */}
            <section className="card pipeline-card" id="governance-pipeline" style={{ marginBottom: '2rem', padding: '1.5rem' }}>
              <div className="card-header" style={{ padding: '0 0 1.25rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', margin: '0 0 0.2rem 0' }}>
                  SCM Release Governance Pipeline
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: 0 }}>
                  Sequential gatekeeping progression from software version baseline to published release
                </p>
              </div>

              <div className="pipeline-stages-container" style={{ display: 'flex', gap: '0.5rem', overflowX: 'auto', paddingBottom: '0.5rem' }}>
                {readinessData.pipeline.map((stage, idx) => {
                  const badge = statusBadgeColors[stage.status] || statusBadgeColors.NOT_APPLICABLE;
                  return (
                    <div
                      key={idx}
                      className="pipeline-stage-box"
                      style={{
                        minWidth: '150px',
                        flex: '1 1 0',
                        border: `1.5px solid ${badge.border}`,
                        background: badge.bg,
                        borderRadius: '8px',
                        padding: '0.85rem',
                        textAlign: 'center',
                        position: 'relative'
                      }}
                    >
                      <div style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: badge.text, marginBottom: '0.25rem' }}>
                        {idx + 1}. {stage.name}
                      </div>
                      <div style={{ fontSize: '1rem', fontWeight: '800', color: badge.text, marginBottom: '0.35rem' }}>
                        {badge.icon} {stage.status}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: '#334155', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {stage.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Step 12: Quality Metrics Summary */}
            <section className="metrics-summary-section" style={{ marginBottom: '2rem' }}>
              <div className="stats-grid stats-grid-6" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
                <div className="stat-card" style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Open Defects</span>
                  <span className="stat-value" id="metric-open-bugs" style={{ fontSize: '1.6rem', fontWeight: '800', color: readinessData.metrics.openBugs > 0 ? '#f59e0b' : '#10b981' }}>
                    {readinessData.metrics.openBugs}
                  </span>
                </div>

                <div className="stat-card" style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Critical Defects</span>
                  <span className="stat-value" id="metric-crit-bugs" style={{ fontSize: '1.6rem', fontWeight: '800', color: readinessData.metrics.criticalBugs > 0 ? '#ef4444' : '#10b981' }}>
                    {readinessData.metrics.criticalBugs}
                  </span>
                </div>

                <div className="stat-card" style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>High Defects</span>
                  <span className="stat-value" id="metric-high-bugs" style={{ fontSize: '1.6rem', fontWeight: '800', color: readinessData.metrics.highBugs > 0 ? '#f59e0b' : '#10b981' }}>
                    {readinessData.metrics.highBugs}
                  </span>
                </div>

                <div className="stat-card" style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Pending CRs</span>
                  <span className="stat-value" id="metric-pending-crs" style={{ fontSize: '1.6rem', fontWeight: '800', color: readinessData.metrics.pendingChangeRequests > 0 ? '#8b5cf6' : '#10b981' }}>
                    {readinessData.metrics.pendingChangeRequests}
                  </span>
                </div>

                <div className="stat-card" style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Traceability Gaps</span>
                  <span className="stat-value" id="metric-trace-gaps" style={{ fontSize: '1.6rem', fontWeight: '800', color: readinessData.metrics.traceabilityGaps > 0 ? '#ef4444' : '#10b981' }}>
                    {readinessData.metrics.traceabilityGaps}
                  </span>
                </div>

                <div className="stat-card" style={{ padding: '1rem', background: '#fff', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                  <span className="stat-label" style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>UVCS Baseline</span>
                  <span className="stat-value" id="metric-uvcs-status" style={{ fontSize: '1.2rem', fontWeight: '800', color: readinessData.metrics.uvcsLinked ? '#10b981' : '#f59e0b' }}>
                    {readinessData.metrics.uvcsLinked ? 'Anchored' : 'Not Linked'}
                  </span>
                </div>
              </div>
            </section>

            {/* Step 7: Readiness Checklist */}
            <section className="card table-card" id="readiness-checklist-card" style={{ marginBottom: '2rem', padding: 0, overflow: 'hidden' }}>
              <div className="card-header" style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
                  SCM Governance Checklist (8 Policies Evaluated)
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Weights sum to 100%
                </span>
              </div>

              <div className="table-responsive" style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
                <table className="data-table" id="readiness-checklist-table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: '100px' }}>Status</th>
                      <th style={{ minWidth: '180px' }}>Policy Check</th>
                      <th style={{ minWidth: '110px' }}>Weight</th>
                      <th style={{ minWidth: '100px' }}>Score</th>
                      <th style={{ minWidth: '320px' }}>Evaluation Rationale &amp; Findings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {readinessData.checks.map((c) => {
                      const badge = statusBadgeColors[c.status] || statusBadgeColors.NOT_APPLICABLE;
                      return (
                        <tr key={c.key}>
                          <td>
                            <span
                              className={`status-pill ${badge.class}`}
                              style={{
                                background: badge.bg,
                                color: badge.text,
                                border: `1px solid ${badge.border}`,
                                fontWeight: '700',
                                fontSize: '0.75rem',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px'
                              }}
                            >
                              {badge.icon} {c.status}
                            </span>
                          </td>
                          <td>
                            <strong>{c.name}</strong>
                            <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                              {c.description}
                            </div>
                          </td>
                          <td>
                            <span style={{ fontWeight: '600' }}>{c.weight}%</span>
                          </td>
                          <td>
                            <strong style={{ color: c.score === c.weight ? '#065f46' : c.score > 0 ? '#854d0e' : '#991b1b' }}>
                              {c.score}
                            </strong>
                          </td>
                          <td style={{ fontSize: '0.88rem', color: '#1e293b' }}>
                            {c.details}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>

            {/* Step 13, 14, 15: Release Details & Cross Navigation */}
            <section className="card release-details-card" id="readiness-release-details" style={{ marginBottom: '2.5rem', padding: '1.5rem' }}>
              <div className="card-header" style={{ padding: '0 0 1rem 0', borderBottom: '1px solid var(--border-color)', marginBottom: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', margin: 0 }}>
                  Release Metadata &amp; Cross-SCM Navigation
                </h3>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <Link
                    to={`/traceability?release=${readinessData.release.releaseName}`}
                    className="btn btn-outline btn-sm"
                    id="btn-nav-traceability"
                  >
                    🧭 View Traceability &rarr;
                  </Link>
                  {readinessData.release.changeRequests && readinessData.release.changeRequests.length > 0 && (
                    <Link
                      to={`/impact-analysis?changeRequest=${readinessData.release.changeRequests[0]._id || readinessData.release.changeRequests[0]}`}
                      className="btn btn-outline btn-sm"
                      id="btn-nav-impact"
                    >
                      ⚡ Analyze Change Impact &rarr;
                    </Link>
                  )}
                  <Link
                    to={`/projects/${readinessData.release.project?._id || readinessData.release.project}/releases/${readinessData.release.id}`}
                    className="btn btn-primary btn-sm"
                    id="btn-nav-release-details"
                  >
                    📦 Release Governance Hub &rarr;
                  </Link>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem', marginBottom: '1.25rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Release Name</div>
                  <div style={{ fontWeight: '700' }}>{readinessData.release.releaseName}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Associated Version</div>
                  <div style={{ fontWeight: '700' }}>
                    {readinessData.release.version ? `v${readinessData.release.version.versionNumber} (${readinessData.release.version.status})` : 'None'}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Governance Status</div>
                  <div>
                    <span className="status-pill status-active" style={{ fontSize: '0.75rem' }}>{readinessData.release.status}</span>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Approved By</div>
                  <div>
                    {readinessData.release.approvedBy ? (
                      <strong>{readinessData.release.approvedBy.name}</strong>
                    ) : (
                      <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Pending Approval</span>
                    )}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: '600' }}>Release Date</div>
                  <div>
                    {readinessData.release.releaseDate ? new Date(readinessData.release.releaseDate).toLocaleDateString() : 'Not scheduled'}
                  </div>
                </div>
              </div>

              {/* Release Notes Preview */}
              <div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: '600', marginBottom: '0.35rem' }}>
                  Compiled Release Notes:
                </div>
                <div style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid var(--border-color)', fontSize: '0.88rem', whiteSpace: 'pre-wrap', maxHeight: '180px', overflowY: 'auto' }}>
                  {readinessData.release.releaseNotes || 'No release notes compiled yet.'}
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

export default ReleaseReadiness;
