import { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { uvcsService } from '../services/api';

const UVCS = () => {
  const [status, setStatus] = useState(null);
  const [branches, setBranches] = useState([]);
  const [changesets, setChangesets] = useState([]);
  const [wkChanges, setWkChanges] = useState(null);
  const [selectedChangeset, setSelectedChangeset] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all');

  const fetchUVCSData = async (refresh = false) => {
    if (refresh) setIsRefreshing(true);
    else setIsLoading(true);
    setErrorMessage('');

    try {
      const [statusRes, branchesRes, changesetsRes, wkChangesRes] = await Promise.all([
        uvcsService.getStatus(),
        uvcsService.getBranches(),
        uvcsService.getChangesets(),
        uvcsService.getWorkspaceChanges()
      ]);

      if (statusRes.success) {
        setStatus(statusRes.data);
      } else {
        setErrorMessage(statusRes.message || 'Failed to load UVCS status');
      }

      if (branchesRes.success) {
        setBranches(branchesRes.branches || []);
      }

      if (changesetsRes.success) {
        setChangesets(changesetsRes.changesets || []);
      }

      if (wkChangesRes.success) {
        setWkChanges(wkChangesRes);
      }
    } catch (err) {
      setErrorMessage(err.message || 'Error communicating with UVCS service');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    fetchUVCSData();
  }, []);

  const handleViewChangeset = async (csId) => {
    try {
      const res = await uvcsService.getChangesetById(csId);
      if (res.success && res.changeset) {
        setSelectedChangeset(res.changeset);
      }
    } catch (err) {
      alert(`Failed to load changeset details: ${err.message}`);
    }
  };

  const filteredChangesets = selectedBranchFilter === 'all'
    ? changesets
    : changesets.filter(cs => cs.branch === selectedBranchFilter);

  if (isLoading) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <div className="page-loading-state">
          <div className="spinner"></div>
          <p>Connecting to Unity Version Control (UVCS)...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="main-content">
        {/* Header with Title & Refresh */}
        <div className="page-header">
          <div className="page-title-group">
            <h2>Unity Version Control (UVCS)</h2>
            <p className="page-subtitle">
              Live Source Control Repository Baselines, Changesets & Workspace Status
            </p>
          </div>

          <div className="header-actions">
            <button
              onClick={() => fetchUVCSData(true)}
              className="btn-action-primary"
              disabled={isRefreshing}
              id="btn-refresh-uvcs"
            >
              {isRefreshing ? '⏳ Refreshing...' : '🔄 Refresh UVCS'}
            </button>
          </div>
        </div>

        {/* Global Notifications */}
        {errorMessage && (
          <div className="alert-error" role="alert" id="uvcs-error-alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Environment Overview Grid */}
        <div className="uvcs-overview-grid">
          {/* Connection Status Card */}
          <div className="card uvcs-status-card" id="card-uvcs-status">
            <div className="card-header">
              <h3>CLI & Connection Status</h3>
              <span className={`status-pill ${status?.connected ? 'status-published' : 'status-deprecated'}`}>
                {status?.connected ? '● Connected' : '○ Offline'}
              </span>
            </div>
            <div className="card-body">
              <div className="meta-list">
                <div className="meta-row">
                  <span className="meta-label">CLI Engine:</span>
                  <span className="meta-value">
                    <strong>Unity Version Control (cm)</strong>
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">CLI Version:</span>
                  <span className="meta-value" id="uvcs-cli-version">
                    <code>{status?.cli?.version || 'Unknown'}</code>
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Binary Path:</span>
                  <span className="meta-value text-break">
                    <code style={{ fontSize: '0.8rem' }}>{status?.cli?.path || 'In PATH'}</code>
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Access Mode:</span>
                  <span className="meta-value">
                    <span className="status-pill status-active" style={{ fontSize: '0.75rem' }}>
                      Read-Only Safe
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Workspace & Repository Card */}
          <div className="card uvcs-repo-card" id="card-uvcs-repo">
            <div className="card-header">
              <h3>Workspace & Repository</h3>
              <span className="status-pill status-active">
                {status?.repository?.spec || 'default@local'}
              </span>
            </div>
            <div className="card-body">
              <div className="meta-list">
                <div className="meta-row">
                  <span className="meta-label">Workspace Name:</span>
                  <span className="meta-value" id="uvcs-workspace-name">
                    <strong>{status?.workspace?.name || 'smart_scm_wk'}</strong>
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Workspace Path:</span>
                  <span className="meta-value text-break">
                    <code style={{ fontSize: '0.8rem' }} id="uvcs-workspace-path">
                      {status?.workspace?.path || 'C:\\Users\\thiru\\.gemini\\antigravity\\scratch\\smart-scm'}
                    </code>
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Current Branch:</span>
                  <span className="meta-value" id="uvcs-current-branch">
                    <strong>{status?.branch || '/main'}</strong>
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Head Changeset:</span>
                  <span className="meta-value" id="uvcs-head-changeset">
                    <span className="status-pill status-in_progress">
                      cs:{status?.headChangeset?.changesetId !== undefined ? status?.headChangeset?.changesetId : 0}
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Controlled Workspace Status Card */}
          <div className="card uvcs-wkstatus-card" id="card-uvcs-workspace">
            <div className="card-header">
              <h3>Pending Changes (Controlled)</h3>
              <span className={`status-pill ${wkChanges?.hasChanges ? 'status-testing' : 'status-completed'}`}>
                {wkChanges?.count || 0} Controlled Changes
              </span>
            </div>
            <div className="card-body">
              {wkChanges?.hasChanges ? (
                <div className="controlled-changes-list">
                  <p className="notice-subtle">Controlled files pending checkin:</p>
                  <ul className="changes-list">
                    {wkChanges.changes.map((ch, idx) => (
                      <li key={idx} className="change-entry">
                        <code>{ch.type}</code> {ch.path}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="empty-state-card" style={{ padding: '1.25rem' }}>
                  <span style={{ fontSize: '1.75rem', marginBottom: '0.5rem' }}>🛡️</span>
                  <p style={{ margin: 0, fontWeight: 500, color: 'var(--text-main)' }}>
                    Workspace Clean & Intact
                  </p>
                  <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    Zero pending controlled changes. Smart SCM files remain protected and private.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* UVCS Branches Section */}
        <section className="card uvcs-section" style={{ marginTop: '1.5rem' }} id="section-branches">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3>Repository Branches ({branches.length})</h3>
              <p className="card-subtitle" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Active branches on <code>{status?.repository?.spec || 'default@local'}</code>
              </p>
            </div>
          </div>
          <div className="card-body table-responsive">
            <table className="data-table" id="branches-table">
              <thead>
                <tr>
                  <th>Branch Name</th>
                  <th>Owner</th>
                  <th>Head Changeset</th>
                  <th>Created Date</th>
                  <th>GUID</th>
                </tr>
              </thead>
              <tbody>
                {branches.length > 0 ? (
                  branches.map(branch => (
                    <tr key={branch.id}>
                      <td>
                        <strong>{branch.name}</strong>{' '}
                        {branch.name === status?.branch && (
                          <span className="status-pill status-active" style={{ fontSize: '0.7rem' }}>
                            Current
                          </span>
                        )}
                      </td>
                      <td>{branch.owner}</td>
                      <td>
                        <span className="status-pill status-in_progress">
                          cs:{branch.changeset}
                        </span>
                      </td>
                      <td>{new Date(branch.date).toLocaleString()}</td>
                      <td>
                        <code style={{ fontSize: '0.75rem' }}>
                          {branch.guid ? branch.guid.substring(0, 8) + '...' : '-'}
                        </code>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="text-center py-4 text-muted">
                      No branches found in repository.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* UVCS Changesets History Section */}
        <section className="card uvcs-section" style={{ marginTop: '1.5rem' }} id="section-changesets">
          <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3>Changeset History ({changesets.length})</h3>
              <p className="card-subtitle" style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Real commits and source baselines stored in Unity Version Control
              </p>
            </div>

            <div className="filter-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <label htmlFor="branch-filter" style={{ fontSize: '0.85rem', fontWeight: 500 }}>
                Filter Branch:
              </label>
              <select
                id="branch-filter"
                value={selectedBranchFilter}
                onChange={(e) => setSelectedBranchFilter(e.target.value)}
                style={{ padding: '0.35rem 0.75rem', borderRadius: '6px', border: '1px solid var(--border-color)' }}
              >
                <option value="all">All Branches</option>
                {branches.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="card-body table-responsive">
            <table className="data-table" id="changesets-table">
              <thead>
                <tr>
                  <th>Changeset</th>
                  <th>Branch</th>
                  <th>Author</th>
                  <th>Date</th>
                  <th>Comment</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredChangesets.length > 0 ? (
                  filteredChangesets.map(cs => (
                    <tr key={cs.id || cs.changesetId}>
                      <td>
                        <span className="status-pill status-in_progress" style={{ fontWeight: 600 }}>
                          cs:{cs.changesetId}
                        </span>
                      </td>
                      <td>
                        <strong>{cs.branch}</strong>
                      </td>
                      <td>{cs.owner || 'all'}</td>
                      <td>{new Date(cs.date).toLocaleString()}</td>
                      <td>
                        {cs.comment ? (
                          <span>{cs.comment}</span>
                        ) : (
                          <span className="text-muted" style={{ fontStyle: 'italic' }}>
                            {cs.changesetId === 0 ? 'Initial repository root' : 'No comment'}
                          </span>
                        )}
                      </td>
                      <td>
                        <button
                          onClick={() => handleViewChangeset(cs.changesetId)}
                          className="btn-action-primary-small"
                          id={`btn-view-cs-${cs.changesetId}`}
                        >
                          🔍 View Details
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="text-center py-4 text-muted">
                      No changesets found matching the selected branch.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* Traceability Baseline Guide */}
        <section className="card uvcs-section" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <h3>Configuration Management Traceability</h3>
            <span className="status-pill status-active">SCM Standard</span>
          </div>
          <div className="card-body">
            <p style={{ lineHeight: '1.6', margin: 0 }}>
              Smart SCM provides configuration management traceability by connecting software version and release records directly to real Unity Version Control baselines.
              Navigate to any <strong>Version Details</strong> or <strong>Release Details</strong> page to link the record to a verified changeset baseline (e.g. <code>cs:0</code> on <code>/main@default@local</code>).
            </p>
          </div>
        </section>

        {/* Changeset Details Modal */}
        {selectedChangeset && (
          <div className="modal-overlay" id="changeset-modal">
            <div className="modal-card modal-large">
              <div className="modal-header">
                <h3>
                  Changeset Details: cs:{selectedChangeset.changesetId} ({selectedChangeset.branch})
                </h3>
                <button
                  onClick={() => setSelectedChangeset(null)}
                  className="btn-modal-close"
                  type="button"
                  id="btn-close-cs-modal"
                >
                  &times;
                </button>
              </div>

              <div className="modal-form">
                <div className="meta-list" style={{ marginBottom: '1.25rem' }}>
                  <div className="meta-row">
                    <span className="meta-label">Changeset ID:</span>
                    <span className="meta-value">
                      <strong>cs:{selectedChangeset.changesetId}</strong>
                    </span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Branch:</span>
                    <span className="meta-value">{selectedChangeset.branch}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Author / Owner:</span>
                    <span className="meta-value">{selectedChangeset.owner}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Timestamp:</span>
                    <span className="meta-value">{new Date(selectedChangeset.date).toLocaleString()}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">Repository:</span>
                    <span className="meta-value">{selectedChangeset.repository}@{selectedChangeset.server}</span>
                  </div>
                  <div className="meta-row">
                    <span className="meta-label">GUID:</span>
                    <span className="meta-value">
                      <code>{selectedChangeset.guid}</code>
                    </span>
                  </div>
                </div>

                <div className="form-group">
                  <label>Affected Items / Revisions ({selectedChangeset.items?.length || 0})</label>
                  {selectedChangeset.items && selectedChangeset.items.length > 0 ? (
                    <div className="table-responsive" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Status</th>
                            <th>Type</th>
                            <th>Path</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedChangeset.items.map((item, idx) => (
                            <tr key={idx}>
                              <td><code>{item.status}</code></td>
                              <td>{item.type}</td>
                              <td><code>{item.path}</code></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="no-members-note" style={{ background: '#f8fafc', padding: '1rem', borderRadius: '6px' }}>
                      {selectedChangeset.changesetId === 0
                        ? 'Initial repository root changeset. No modified items.'
                        : 'No affected files recorded for this changeset.'}
                    </p>
                  )}
                </div>

                <div className="modal-actions" style={{ marginTop: '1.5rem', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setSelectedChangeset(null)}
                    className="btn-action-primary"
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

export default UVCS;
