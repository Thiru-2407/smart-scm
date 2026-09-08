import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { projectService, versionService, bugService, changeRequestService, releaseService } from '../services/api';

const statusLabels = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived'
};

const versionStatusLabels = {
  development: 'In Development',
  testing: 'In Testing / QA',
  released: 'Released',
  deprecated: 'Deprecated'
};

const releaseStatusLabels = {
  draft: 'Draft',
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  published: 'Published',
  withdrawn: 'Withdrawn'
};

const severityLabels = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const priorityLabels = {
  urgent: 'Urgent',
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

const bugStatusLabels = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
  closed: 'Closed',
  reopened: 'Reopened'
};

const crStatusLabels = {
  submitted: 'Submitted',
  under_review: 'Under Review',
  approved: 'Approved',
  rejected: 'Rejected',
  implemented: 'Implemented',
  cancelled: 'Cancelled'
};

const roleLabels = {
  admin: 'Administrator',
  project_manager: 'Project Manager',
  developer: 'Developer',
  tester: 'QA / Tester'
};

const ProjectDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [project, setProject] = useState(null);
  const [versions, setVersions] = useState([]);
  const [bugs, setBugs] = useState([]);
  const [changeRequests, setChangeRequests] = useState([]);
  const [releases, setReleases] = useState([]);
  const [availableUsers, setAvailableUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Active view tab: 'versions' | 'bugs' | 'change-requests' | 'releases'
  const [activeTab, setActiveTab] = useState('versions');

  // Project Modals state
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Edit project form state
  const [editFormData, setEditFormData] = useState({
    name: '',
    key: '',
    description: '',
    status: 'planning'
  });
  const [editError, setEditError] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Member management state
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isAddingMember, setIsAddingMember] = useState(false);

  // Version management state
  const [showCreateVersionModal, setShowCreateVersionModal] = useState(false);
  const [versionFormData, setVersionFormData] = useState({
    versionNumber: '',
    name: '',
    description: '',
    status: 'development',
    releaseDate: '',
    changes: ['']
  });
  const [versionError, setVersionError] = useState('');
  const [isCreatingVersion, setIsCreatingVersion] = useState(false);

  // Bug management state
  const [showCreateBugModal, setShowCreateBugModal] = useState(false);
  const [bugFormData, setBugFormData] = useState({
    title: '',
    description: '',
    severity: 'medium',
    priority: 'medium',
    assignedTo: ''
  });
  const [bugError, setBugError] = useState('');
  const [isCreatingBug, setIsCreatingBug] = useState(false);

  // Change Request management state
  const [showCreateCRModal, setShowCreateCRModal] = useState(false);
  const [crFormData, setCrFormData] = useState({
    title: '',
    description: '',
    reason: '',
    priority: 'medium'
  });
  const [crError, setCrError] = useState('');
  const [isCreatingCR, setIsCreatingCR] = useState(false);

  // Release management state
  const [showCreateReleaseModal, setShowCreateReleaseModal] = useState(false);
  const [releaseFormData, setReleaseFormData] = useState({
    version: '',
    releaseName: '',
    description: '',
    releaseDate: ''
  });
  const [releaseError, setReleaseError] = useState('');
  const [isCreatingRelease, setIsCreatingRelease] = useState(false);

  const fetchProjectData = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');

      const [projRes, versionsRes, usersRes, bugsRes, crRes, relRes] = await Promise.all([
        projectService.getProjectById(id),
        versionService.getVersions(id),
        projectService.getAvailableUsers(),
        bugService.getBugs(id),
        changeRequestService.getChangeRequests(id),
        releaseService.getReleases(id)
      ]);

      if (projRes.success && projRes.project) {
        setProject(projRes.project);
        setEditFormData({
          name: projRes.project.name,
          key: projRes.project.key,
          description: projRes.project.description || '',
          status: projRes.project.status
        });
      }

      if (versionsRes.success) {
        setVersions(versionsRes.versions || []);
      }

      if (usersRes.success) {
        setAvailableUsers(usersRes.users || []);
      }

      if (bugsRes.success) {
        setBugs(bugsRes.bugs || []);
      }

      if (crRes.success) {
        setChangeRequests(crRes.changeRequests || []);
      }

      if (relRes.success) {
        setReleases(relRes.releases || []);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load project details');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
  }, [id]);

  const isOwner = project && user && project.owner?._id === user.id;
  const isAdmin = user && user.role === 'admin';
  const canManage = isOwner || isAdmin;

  const unassignedUsers = availableUsers.filter((u) => {
    if (!project) return false;
    const isProjOwner = project.owner?._id === u._id;
    const isMember = project.members?.some((m) => m._id === u._id);
    return !isProjOwner && !isMember;
  });

  // Project members + owner can be assigned to bugs
  const assignableUsers = [];
  if (project?.owner) {
    assignableUsers.push(project.owner);
  }
  if (project?.members) {
    project.members.forEach((m) => {
      if (!assignableUsers.some((u) => u._id === m._id)) {
        assignableUsers.push(m);
      }
    });
  }

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    setEditError('');

    try {
      setIsUpdating(true);
      const response = await projectService.updateProject(id, editFormData);
      if (response.success && response.project) {
        setProject(response.project);
        setShowEditModal(false);
        setSuccessMessage('Project updated successfully.');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setEditError(error.message || 'Failed to update project');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteProject = async () => {
    try {
      const response = await projectService.deleteProject(id);
      if (response.success) {
        navigate('/projects', { replace: true });
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to delete project');
      setShowDeleteModal(false);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedUserId) return;

    try {
      setIsAddingMember(true);
      setErrorMessage('');
      const response = await projectService.addMember(id, selectedUserId);
      if (response.success && response.project) {
        setProject(response.project);
        setSelectedUserId('');
        setSuccessMessage('Team member added successfully.');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to add member');
    } finally {
      setIsAddingMember(false);
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      setErrorMessage('');
      const response = await projectService.removeMember(id, userId);
      if (response.success && response.project) {
        setProject(response.project);
        setSuccessMessage('Member removed from project.');
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to remove member');
    }
  };

  // Version creation handlers
  const handleAddVersionChange = () => {
    setVersionFormData(prev => ({
      ...prev,
      changes: [...prev.changes, '']
    }));
  };

  const handleRemoveVersionChange = (index) => {
    setVersionFormData(prev => ({
      ...prev,
      changes: prev.changes.filter((_, idx) => idx !== index)
    }));
  };

  const handleVersionChangeText = (index, value) => {
    setVersionFormData(prev => {
      const updated = [...prev.changes];
      updated[index] = value;
      return { ...prev, changes: updated };
    });
  };

  const handleCreateVersion = async (e) => {
    e.preventDefault();
    setVersionError('');

    if (!versionFormData.versionNumber.trim() || !versionFormData.name.trim()) {
      setVersionError('Please provide both a version number and name.');
      return;
    }

    try {
      setIsCreatingVersion(true);
      const cleanChanges = versionFormData.changes.map(c => c.trim()).filter(Boolean);

      const response = await versionService.createVersion(id, {
        ...versionFormData,
        changes: cleanChanges
      });

      if (response.success && response.version) {
        setVersions(prev => [response.version, ...prev]);
        setShowCreateVersionModal(false);
        setVersionFormData({
          versionNumber: '',
          name: '',
          description: '',
          status: 'development',
          releaseDate: '',
          changes: ['']
        });
        setSuccessMessage(`Version ${response.version.versionNumber} registered successfully.`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setVersionError(error.message || 'Failed to create version');
    } finally {
      setIsCreatingVersion(false);
    }
  };

  // Bug creation handler
  const handleCreateBug = async (e) => {
    e.preventDefault();
    setBugError('');

    if (!bugFormData.title.trim() || !bugFormData.description.trim()) {
      setBugError('Please provide both a bug title and description.');
      return;
    }

    try {
      setIsCreatingBug(true);
      const payload = {
        title: bugFormData.title.trim(),
        description: bugFormData.description.trim(),
        severity: bugFormData.severity,
        priority: bugFormData.priority,
        assignedTo: bugFormData.assignedTo || null
      };

      const response = await bugService.createBug(id, payload);

      if (response.success && response.bug) {
        setBugs(prev => [response.bug, ...prev]);
        setShowCreateBugModal(false);
        setBugFormData({
          title: '',
          description: '',
          severity: 'medium',
          priority: 'medium',
          assignedTo: ''
        });
        setSuccessMessage(`Bug '${response.bug.title}' logged successfully.`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setBugError(error.message || 'Failed to report bug');
    } finally {
      setIsCreatingBug(false);
    }
  };

  // Change Request creation handler
  const handleCreateChangeRequest = async (e) => {
    e.preventDefault();
    setCrError('');

    if (!crFormData.title.trim() || !crFormData.description.trim() || !crFormData.reason.trim()) {
      setCrError('Please provide title, description, and business justification (reason).');
      return;
    }

    try {
      setIsCreatingCR(true);
      const payload = {
        title: crFormData.title.trim(),
        description: crFormData.description.trim(),
        reason: crFormData.reason.trim(),
        priority: crFormData.priority
      };

      const response = await changeRequestService.createChangeRequest(id, payload);

      if (response.success && response.changeRequest) {
        setChangeRequests(prev => [response.changeRequest, ...prev]);
        setShowCreateCRModal(false);
        setCrFormData({
          title: '',
          description: '',
          reason: '',
          priority: 'medium'
        });
        setSuccessMessage(`Change Request '${response.changeRequest.title}' submitted successfully.`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setCrError(error.message || 'Failed to submit change request');
    } finally {
      setIsCreatingCR(false);
    }
  };

  // Release creation handler
  const handleCreateRelease = async (e) => {
    e.preventDefault();
    setReleaseError('');

    if (!releaseFormData.version) {
      setReleaseError('Please select a target software version baseline.');
      return;
    }

    if (!releaseFormData.releaseName.trim()) {
      setReleaseError('Please provide a release name.');
      return;
    }

    try {
      setIsCreatingRelease(true);
      const payload = {
        version: releaseFormData.version,
        releaseName: releaseFormData.releaseName.trim(),
        description: releaseFormData.description.trim(),
        releaseDate: releaseFormData.releaseDate || null
      };

      const response = await releaseService.createRelease(id, payload);

      if (response.success && response.release) {
        setReleases(prev => [response.release, ...prev]);
        setShowCreateReleaseModal(false);
        setReleaseFormData({
          version: '',
          releaseName: '',
          description: '',
          releaseDate: ''
        });
        setSuccessMessage(`Release '${response.release.releaseName}' created in Draft status.`);
        setTimeout(() => setSuccessMessage(''), 4000);
      }
    } catch (error) {
      setReleaseError(error.message || 'Failed to create release');
    } finally {
      setIsCreatingRelease(false);
    }
  };

  if (isLoading) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <div className="page-loading-state">
          <div className="spinner"></div>
          <p>Loading project details...</p>
        </div>
      </div>
    );
  }

  if (!project) {
    return (
      <div className="dashboard-layout">
        <Navbar />
        <main className="main-content">
          <div className="empty-state-card">
            <h3>Project Not Found</h3>
            <p>The requested software project does not exist or has been removed.</p>
            <Link to="/projects" className="btn-action-primary">
              &larr; Back to Projects
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
          <Link to="/projects" className="breadcrumb-link">&larr; Back to Projects</Link>
        </nav>

        {/* Global Notifications */}
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

        {/* Project Header Card */}
        <div className="project-detail-header card">
          <div className="header-info">
            <div className="key-and-status">
              <span className="project-key-tag large">{project.key}</span>
              <span className={`status-pill status-${project.status}`}>
                {statusLabels[project.status] || project.status}
              </span>
            </div>
            <h1 className="project-detail-title">{project.name}</h1>
            <p className="project-detail-description">
              {project.description || 'No detailed description provided.'}
            </p>
          </div>

          {canManage && (
            <div className="header-actions">
              <button
                onClick={() => {
                  setEditError('');
                  setShowEditModal(true);
                }}
                className="btn-secondary"
                id="btn-edit-project"
              >
                ✏️ Edit Project
              </button>
              <button
                onClick={() => setShowDeleteModal(true)}
                className="btn-danger-outline"
                id="btn-delete-project"
              >
                🗑️ Delete Project
              </button>
            </div>
          )}
        </div>

        {/* Project Metadata Grid */}
        <div className="details-grid">
          <div className="card info-card">
            <div className="card-header">
              <h3>Configuration Baseline Metadata</h3>
            </div>
            <div className="card-body">
              <div className="meta-list">
                <div className="meta-row">
                  <span className="meta-label">Project Owner</span>
                  <span className="meta-value">
                    <strong>{project.owner?.name}</strong> ({project.owner?.email}) &mdash;{' '}
                    <span className={`role-badge role-${project.owner?.role}`}>
                      {roleLabels[project.owner?.role] || project.owner?.role}
                    </span>
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">System Key</span>
                  <span className="meta-value code-val">{project.key}</span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Created At</span>
                  <span className="meta-value">
                    {new Date(project.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="meta-row">
                  <span className="meta-label">Last Updated</span>
                  <span className="meta-value">
                    {new Date(project.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Member Management Card */}
          <div className="card members-card">
            <div className="card-header">
              <h3>Team Members ({project.members?.length || 0})</h3>
              <span className="badge-upcoming">Access Control</span>
            </div>
            <div className="card-body">
              {canManage && (
                <form onSubmit={handleAddMember} className="add-member-form">
                  <select
                    id="select-add-member"
                    value={selectedUserId}
                    onChange={(e) => setSelectedUserId(e.target.value)}
                    disabled={isAddingMember || unassignedUsers.length === 0}
                  >
                    <option value="">
                      {unassignedUsers.length === 0
                        ? 'All registered users are already assigned'
                        : '-- Select registered user to add --'}
                    </option>
                    {unassignedUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.email}) - {roleLabels[u.role] || u.role}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="btn-action-primary"
                    id="btn-add-member"
                    disabled={!selectedUserId || isAddingMember}
                  >
                    {isAddingMember ? 'Adding...' : '+ Add Member'}
                  </button>
                </form>
              )}

              <div className="members-list">
                <div className="member-item member-owner">
                  <div className="member-avatar">👑</div>
                  <div className="member-info">
                    <span className="member-name">{project.owner?.name}</span>
                    <span className="member-email">{project.owner?.email}</span>
                  </div>
                  <div className="member-role-tags">
                    <span className="badge-owner">Project Lead / Owner</span>
                  </div>
                </div>

                {project.members && project.members.length > 0 ? (
                  project.members.map((member) => (
                    <div key={member._id} className="member-item" data-member-id={member._id}>
                      <div className="member-avatar">👤</div>
                      <div className="member-info">
                        <span className="member-name">{member.name}</span>
                        <span className="member-email">{member.email}</span>
                      </div>
                      <div className="member-role-tags">
                        <span className={`role-badge role-${member.role}`}>
                          {roleLabels[member.role] || member.role}
                        </span>
                        {canManage && (
                          <button
                            onClick={() => handleRemoveMember(member._id)}
                            className="btn-remove-member"
                            title="Remove member from project"
                            type="button"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="no-members-note">
                    No additional team members assigned yet. {canManage && 'Use the selector above to assign registered users.'}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* SCM Configuration Traceability Pipeline Bar */}
        <div className="card scm-traceability-pipeline-card" style={{ marginBottom: '1.5rem', background: '#f8fafc', padding: '1rem 1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
              <span style={{ fontSize: '1.25rem' }}>🔗</span>
              <div>
                <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>Configuration Management Traceability Pipeline</strong>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  End-to-end audit trail: Project &rarr; Version Baseline &rarr; Release Milestone &rarr; Unity VCS Repository Changeset
                </p>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
              <span className="project-key-tag">{project.key}</span>
              <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
              <span className="version-number-tag">v{versions[0]?.versionNumber || '1.0.0'}</span>
              <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
              <span className="status-pill status-published" style={{ fontSize: '0.72rem' }}>
                {releases[0] ? releases[0].releaseName : 'Release Tracked'}
              </span>
              <span style={{ color: 'var(--text-muted)' }}>&rarr;</span>
              <code style={{ background: '#e2e8f0', padding: '0.2rem 0.45rem', borderRadius: '4px', fontWeight: '700', color: '#1e293b' }}>
                {versions[0]?.uvcs?.changesetId !== null && versions[0]?.uvcs?.changesetId !== undefined
                  ? `cs:${versions[0].uvcs.changesetId}@/main`
                  : (releases[0]?.uvcs?.changesetId !== null && releases[0]?.uvcs?.changesetId !== undefined
                    ? `cs:${releases[0].uvcs.changesetId}@/main`
                    : 'cs:0@/main')}
              </code>
            </div>
          </div>
        </div>

        {/* ================================================================= */}
        {/* SCM Modules Tabbed Navigation                                      */}
        {/* ================================================================= */}
        <div className="scm-tabs-container">
          <div className="scm-tabs-nav" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'versions'}
              className={`scm-tab-button ${activeTab === 'versions' ? 'active' : ''}`}
              id="tab-btn-versions"
              onClick={() => setActiveTab('versions')}
            >
              🚀 Versions & Releases <span className="tab-counter">{versions.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'bugs'}
              className={`scm-tab-button ${activeTab === 'bugs' ? 'active' : ''}`}
              id="tab-btn-bugs"
              onClick={() => setActiveTab('bugs')}
            >
              🐛 Bug Tracking <span className="tab-counter">{bugs.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'change-requests'}
              className={`scm-tab-button ${activeTab === 'change-requests' ? 'active' : ''}`}
              id="tab-btn-crs"
              onClick={() => setActiveTab('change-requests')}
            >
              📝 Change Requests <span className="tab-counter">{changeRequests.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'releases'}
              className={`scm-tab-button ${activeTab === 'releases' ? 'active' : ''}`}
              id="tab-btn-releases"
              onClick={() => setActiveTab('releases')}
            >
              📦 Releases <span className="tab-counter">{releases.length}</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'reports'}
              className={`scm-tab-button ${activeTab === 'reports' ? 'active' : ''}`}
              id="tab-btn-reports"
              onClick={() => setActiveTab('reports')}
            >
              📊 Reports
            </button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* TAB 1: Software Versions & Releases                               */}
        {/* ================================================================= */}
        {activeTab === 'versions' && (
          <section className="versions-section">
            <div className="section-title-row">
              <div>
                <h3>Software Versions & Releases ({versions.length})</h3>
                <p>Configuration management release milestones and change records for this project.</p>
              </div>
              {canManage && (
                <button
                  onClick={() => {
                    setVersionError('');
                    setShowCreateVersionModal(true);
                  }}
                  className="btn-action-primary"
                  id="btn-open-create-version"
                >
                  + New Version
                </button>
              )}
            </div>

            {versions.length === 0 ? (
              <div className="empty-state-card" id="empty-versions-state">
                <div className="empty-icon">🚀</div>
                <h3>No Software Versions Created</h3>
                <p>Register the initial release baseline (e.g. v1.0.0) to start tracking version configurations and changelogs.</p>
                {canManage && (
                  <button
                    onClick={() => setShowCreateVersionModal(true)}
                    className="btn-action-primary"
                  >
                    Create Initial Version
                  </button>
                )}
              </div>
            ) : (
              <div className="table-responsive card">
                <table className="data-table" id="versions-table">
                  <thead>
                    <tr>
                      <th>Version Number</th>
                      <th>Name</th>
                      <th>Status</th>
                      <th>Release Date</th>
                      <th>Created By</th>
                      <th>Changes</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {versions.map((ver) => (
                      <tr key={ver._id} className="version-row" data-version-number={ver.versionNumber}>
                        <td>
                          <span className="version-number-tag">
                            v{ver.versionNumber}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/projects/${project._id}/versions/${ver._id}`}
                            className="version-title-link"
                          >
                            {ver.name}
                          </Link>
                          {ver.description && (
                            <p className="project-desc-excerpt">{ver.description}</p>
                          )}
                        </td>
                        <td>
                          <span className={`status-pill status-${ver.status}`}>
                            {versionStatusLabels[ver.status] || ver.status}
                          </span>
                        </td>
                        <td>
                          <span className="date-text">
                            {ver.releaseDate
                              ? new Date(ver.releaseDate).toLocaleDateString()
                              : 'Not scheduled'}
                          </span>
                        </td>
                        <td>
                          <span className="owner-name">
                            {ver.createdBy?.name || 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <span className="changes-count-badge">
                            {ver.changes?.length || 0} {(ver.changes?.length || 0) === 1 ? 'change' : 'changes'}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/projects/${project._id}/versions/${ver._id}`}
                            className="btn-table-action"
                          >
                            View Details &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* TAB 2: Bug Tracking                                               */}
        {/* ================================================================= */}
        {activeTab === 'bugs' && (
          <section className="bugs-section">
            <div className="section-title-row">
              <div>
                <h3>Bug Tracking & Defect Reports ({bugs.length})</h3>
                <p>Track issues, severity, priority, and assign resolution tasks to developers.</p>
              </div>
              <button
                onClick={() => {
                  setBugError('');
                  setShowCreateBugModal(true);
                }}
                className="btn-action-primary"
                id="btn-open-create-bug"
              >
                + Report Bug
              </button>
            </div>

            {bugs.length === 0 ? (
              <div className="empty-state-card" id="empty-bugs-state">
                <div className="empty-icon">🐛</div>
                <h3>No Bugs Reported</h3>
                <p>No defects or issues have been logged for this project yet.</p>
                <button
                  onClick={() => setShowCreateBugModal(true)}
                  className="btn-action-primary"
                >
                  Report Initial Bug
                </button>
              </div>
            ) : (
              <div className="table-responsive card">
                <table className="data-table" id="bugs-table">
                  <thead>
                    <tr>
                      <th>Bug ID</th>
                      <th>Title</th>
                      <th>Severity</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Assigned Developer</th>
                      <th>Reported By</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bugs.map((bug) => (
                      <tr key={bug._id} className="bug-row" data-bug-id={bug._id}>
                        <td>
                          <span className="badge-tag bug-tag">
                            BUG-{bug._id.slice(-6).toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/projects/${project._id}/bugs/${bug._id}`}
                            className="version-title-link"
                          >
                            {bug.title}
                          </Link>
                          {bug.description && (
                            <p className="project-desc-excerpt">{bug.description}</p>
                          )}
                        </td>
                        <td>
                          <span className={`severity-badge severity-${bug.severity}`}>
                            {severityLabels[bug.severity] || bug.severity}
                          </span>
                        </td>
                        <td>
                          <span className={`priority-badge priority-${bug.priority}`}>
                            {priorityLabels[bug.priority] || bug.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill status-${bug.status}`}>
                            {bugStatusLabels[bug.status] || bug.status}
                          </span>
                        </td>
                        <td>
                          {bug.assignedTo ? (
                            <span className="owner-name">
                              {bug.assignedTo.name}
                            </span>
                          ) : (
                            <span style={{ color: '#d97706', fontSize: '0.85rem' }}>
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="owner-name">
                            {bug.reportedBy?.name || 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <span className="date-text">
                            {new Date(bug.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/projects/${project._id}/bugs/${bug._id}`}
                            className="btn-table-action"
                          >
                            View Details &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* TAB 3: Change Requests                                            */}
        {/* ================================================================= */}
        {activeTab === 'change-requests' && (
          <section className="change-requests-section">
            <div className="section-title-row">
              <div>
                <h3>Change Requests ({changeRequests.length})</h3>
                <p>Formal configuration change proposals, impact evaluations, and lead approvals.</p>
              </div>
              <button
                onClick={() => {
                  setCrError('');
                  setShowCreateCRModal(true);
                }}
                className="btn-action-primary"
                id="btn-open-create-cr"
              >
                + New Change Request
              </button>
            </div>

            {changeRequests.length === 0 ? (
              <div className="empty-state-card" id="empty-crs-state">
                <div className="empty-icon">📝</div>
                <h3>No Change Requests Submitted</h3>
                <p>Submit formal proposals for feature enhancements, architecture shifts, or requirement changes.</p>
                <button
                  onClick={() => setShowCreateCRModal(true)}
                  className="btn-action-primary"
                >
                  Submit Change Request
                </button>
              </div>
            ) : (
              <div className="table-responsive card">
                <table className="data-table" id="change-requests-table">
                  <thead>
                    <tr>
                      <th>CR ID</th>
                      <th>Title & Business Reason</th>
                      <th>Priority</th>
                      <th>Status</th>
                      <th>Requested By</th>
                      <th>Reviewer</th>
                      <th>Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {changeRequests.map((cr) => (
                      <tr key={cr._id} className="cr-row" data-cr-id={cr._id}>
                        <td>
                          <span className="badge-tag cr-tag">
                            CR-{cr._id.slice(-6).toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/projects/${project._id}/change-requests/${cr._id}`}
                            className="version-title-link"
                          >
                            {cr.title}
                          </Link>
                          {cr.reason && (
                            <p className="project-desc-excerpt">
                              <strong>Reason:</strong> {cr.reason}
                            </p>
                          )}
                        </td>
                        <td>
                          <span className={`priority-badge priority-${cr.priority}`}>
                            {priorityLabels[cr.priority] || cr.priority}
                          </span>
                        </td>
                        <td>
                          <span className={`status-pill status-${cr.status}`}>
                            {crStatusLabels[cr.status] || cr.status}
                          </span>
                        </td>
                        <td>
                          <span className="owner-name">
                            {cr.requestedBy?.name || 'Unknown'}
                          </span>
                        </td>
                        <td>
                          {cr.reviewedBy ? (
                            <span className="owner-name">{cr.reviewedBy.name}</span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>
                              Pending
                            </span>
                          )}
                        </td>
                        <td>
                          <span className="date-text">
                            {new Date(cr.createdAt).toLocaleDateString()}
                          </span>
                        </td>
                        <td>
                          <Link
                            to={`/projects/${project._id}/change-requests/${cr._id}`}
                            className="btn-table-action"
                          >
                            View Details &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* TAB 4: Application Releases & Governance                          */}
        {/* ================================================================= */}
        {activeTab === 'releases' && (
          <section className="releases-section">
            <div className="section-title-row">
              <div>
                <h3>Software Releases & Governance ({releases.length})</h3>
                <p>Formal release milestones, approval pipelines, live release notes, and production baselines.</p>
              </div>
              {canManage && (
                <button
                  onClick={() => {
                    setReleaseError('');
                    setReleaseFormData({
                      version: versions.length > 0 ? versions[0]._id : '',
                      releaseName: '',
                      description: '',
                      releaseDate: ''
                    });
                    setShowCreateReleaseModal(true);
                  }}
                  className="btn-action-primary"
                  id="btn-open-create-release"
                >
                  + Create Release
                </button>
              )}
            </div>

            {releases.length === 0 ? (
              <div className="empty-state-card" id="empty-releases-state">
                <div className="empty-icon">📦</div>
                <h3>No Releases Created</h3>
                <p>Package an approved software version into a formal release for governance and deployment.</p>
                {canManage && (
                  <button
                    onClick={() => {
                      setReleaseError('');
                      setReleaseFormData({
                        version: versions.length > 0 ? versions[0]._id : '',
                        releaseName: '',
                        description: '',
                        releaseDate: ''
                      });
                      setShowCreateReleaseModal(true);
                    }}
                    className="btn-action-primary"
                  >
                    Create Initial Release
                  </button>
                )}
              </div>
            ) : (
              <div className="table-responsive card">
                <table className="data-table" id="releases-table">
                  <thead>
                    <tr>
                      <th>Release Name</th>
                      <th>Version</th>
                      <th>Status</th>
                      <th>Target Date</th>
                      <th>Created By</th>
                      <th>Approved By</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {releases.map((rel) => (
                      <tr key={rel._id} className="release-row" data-release-id={rel._id}>
                        <td>
                          <Link
                            to={`/projects/${project._id}/releases/${rel._id}`}
                            className="version-title-link"
                          >
                            {rel.releaseName}
                          </Link>
                          {rel.description && (
                            <p className="project-desc-excerpt">{rel.description}</p>
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
                          <span className="owner-name">
                            {rel.createdBy?.name || 'Unknown'}
                          </span>
                        </td>
                        <td>
                          {rel.approvedBy ? (
                            <span className="owner-name">{rel.approvedBy.name}</span>
                          ) : (
                            <span style={{ color: '#64748b', fontSize: '0.85rem', fontStyle: 'italic' }}>
                              Pending
                            </span>
                          )}
                        </td>
                        <td>
                          <Link
                            to={`/projects/${project._id}/releases/${rel._id}`}
                            className="btn-table-action"
                          >
                            View Details &rarr;
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* ================================================================= */}
        {/* TAB 5: Project Reports & SCM Analytics                            */}
        {/* ================================================================= */}
        {activeTab === 'reports' && (
          <section className="reports-section">
            <div className="section-title-row">
              <div>
                <h3>Project SCM Reports &amp; Analytics</h3>
                <p>Real-time lifecycle summaries, defect resolution metrics, and release baselines for this project.</p>
              </div>
              <Link
                to={`/reports?project=${project._id}`}
                className="btn-action-primary"
                id="btn-view-full-report"
              >
                📊 View Full Report &rarr;
              </Link>
            </div>

            <div className="stats-grid stats-grid-4" style={{ marginBottom: '1.5rem' }}>
              {/* Version Summary Card */}
              <div className="card report-summary-card" id="project-report-version-summary">
                <div className="card-header">
                  <h4>🚀 Software Versions ({versions.length})</h4>
                </div>
                <div className="card-body">
                  <div className="dist-item">
                    <span>Released</span>
                    <strong>{versions.filter(v => v.status === 'released').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Testing / QA</span>
                    <strong>{versions.filter(v => v.status === 'testing').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>In Development</span>
                    <strong>{versions.filter(v => v.status === 'development').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Deprecated</span>
                    <strong>{versions.filter(v => v.status === 'deprecated').length}</strong>
                  </div>
                </div>
              </div>

              {/* Bug Quality Summary Card */}
              <div className="card report-summary-card" id="project-report-bug-summary">
                <div className="card-header">
                  <h4>🐛 Defect Quality ({bugs.length})</h4>
                </div>
                <div className="card-body">
                  <div className="dist-item">
                    <span>Resolution Rate</span>
                    <strong style={{ color: '#16a34a' }}>
                      {bugs.length > 0
                        ? `${Math.round(((bugs.filter(b => b.status === 'resolved' || b.status === 'closed').length) / bugs.length) * 1000) / 10}%`
                        : '100%'}
                    </strong>
                  </div>
                  <div className="dist-item">
                    <span>Resolved / Closed</span>
                    <strong>{bugs.filter(b => b.status === 'resolved' || b.status === 'closed').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Open / Triage</span>
                    <strong>{bugs.filter(b => b.status === 'open').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Critical Severity</span>
                    <strong style={{ color: '#dc2626' }}>{bugs.filter(b => b.severity === 'critical').length}</strong>
                  </div>
                </div>
              </div>

              {/* Change Request Summary Card */}
              <div className="card report-summary-card" id="project-report-cr-summary">
                <div className="card-header">
                  <h4>📝 Change Proposals ({changeRequests.length})</h4>
                </div>
                <div className="card-body">
                  <div className="dist-item">
                    <span>Approved</span>
                    <strong style={{ color: '#16a34a' }}>{changeRequests.filter(c => c.status === 'approved').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Implemented</span>
                    <strong>{changeRequests.filter(c => c.status === 'implemented').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Under Review</span>
                    <strong>{changeRequests.filter(c => c.status === 'under_review').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Submitted</span>
                    <strong>{changeRequests.filter(c => c.status === 'submitted').length}</strong>
                  </div>
                </div>
              </div>

              {/* Release Summary Card */}
              <div className="card report-summary-card" id="project-report-release-summary">
                <div className="card-header">
                  <h4>📦 Formal Releases ({releases.length})</h4>
                </div>
                <div className="card-body">
                  <div className="dist-item">
                    <span>Published</span>
                    <strong style={{ color: '#16a34a' }}>{releases.filter(r => r.status === 'published').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Approved</span>
                    <strong>{releases.filter(r => r.status === 'approved').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Pending Approval</span>
                    <strong>{releases.filter(r => r.status === 'pending_approval').length}</strong>
                  </div>
                  <div className="dist-item">
                    <span>Draft</span>
                    <strong>{releases.filter(r => r.status === 'draft').length}</strong>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Create Version Modal */}
        {showCreateVersionModal && (
          <div className="modal-overlay">
            <div className="modal-card modal-large">
              <div className="modal-header">
                <h3>Create New Software Version</h3>
                <button
                  onClick={() => setShowCreateVersionModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {versionError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{versionError}</span>
                </div>
              )}

              <form onSubmit={handleCreateVersion} className="modal-form">
                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="ver-num">Version Number *</label>
                    <input
                      id="ver-num"
                      name="versionNumber"
                      type="text"
                      placeholder="e.g. 1.0.0"
                      value={versionFormData.versionNumber}
                      onChange={(e) => setVersionFormData({ ...versionFormData, versionNumber: e.target.value })}
                      disabled={isCreatingVersion}
                      required
                    />
                    <span className="form-hint">Unique version format (e.g. 1.0.0, 1.1.0, 2.0.0-rc1)</span>
                  </div>

                  <div className="form-group">
                    <label htmlFor="ver-name">Version Name *</label>
                    <input
                      id="ver-name"
                      name="name"
                      type="text"
                      placeholder="e.g. Initial Production Release"
                      value={versionFormData.name}
                      onChange={(e) => setVersionFormData({ ...versionFormData, name: e.target.value })}
                      disabled={isCreatingVersion}
                      required
                    />
                  </div>
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="ver-status">Lifecycle Status</label>
                    <select
                      id="ver-status"
                      name="status"
                      value={versionFormData.status}
                      onChange={(e) => setVersionFormData({ ...versionFormData, status: e.target.value })}
                      disabled={isCreatingVersion}
                    >
                      <option value="development">In Development</option>
                      <option value="testing">In Testing / QA</option>
                      <option value="released">Released</option>
                      <option value="deprecated">Deprecated</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="ver-date">Target Release Date</label>
                    <input
                      id="ver-date"
                      name="releaseDate"
                      type="date"
                      value={versionFormData.releaseDate}
                      onChange={(e) => setVersionFormData({ ...versionFormData, releaseDate: e.target.value })}
                      disabled={isCreatingVersion}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="ver-desc">Version Description</label>
                  <textarea
                    id="ver-desc"
                    name="description"
                    rows="3"
                    placeholder="Milestone goals, architecture adjustments, or release context..."
                    value={versionFormData.description}
                    onChange={(e) => setVersionFormData({ ...versionFormData, description: e.target.value })}
                    disabled={isCreatingVersion}
                  />
                </div>

                {/* Multiple Change Entries */}
                <div className="form-group">
                  <div className="label-row-between">
                    <label>Recorded Change Entries</label>
                    <button
                      type="button"
                      onClick={handleAddVersionChange}
                      className="btn-link-small"
                      id="btn-add-ver-change"
                    >
                      + Add Change Item
                    </button>
                  </div>
                  <div className="changes-input-container">
                    {versionFormData.changes.map((item, idx) => (
                      <div key={idx} className="change-input-row">
                        <input
                          type="text"
                          placeholder={`Change entry #${idx + 1} (e.g. Added user login, Fixed CSS)`}
                          value={item}
                          onChange={(e) => handleVersionChangeText(idx, e.target.value)}
                          className="input-ver-change"
                          disabled={isCreatingVersion}
                        />
                        {versionFormData.changes.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveVersionChange(idx)}
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
                    onClick={() => setShowCreateVersionModal(false)}
                    className="btn-secondary"
                    disabled={isCreatingVersion}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-submit-version"
                    disabled={isCreatingVersion}
                  >
                    {isCreatingVersion ? 'Creating Version...' : 'Create Version'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Bug Modal */}
        {showCreateBugModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Report Defect / Bug</h3>
                <button
                  onClick={() => setShowCreateBugModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {bugError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{bugError}</span>
                </div>
              )}

              <form onSubmit={handleCreateBug} className="modal-form">
                <div className="form-group">
                  <label htmlFor="bug-title">Bug Summary / Title *</label>
                  <input
                    id="bug-title"
                    type="text"
                    placeholder="Brief description of the defect"
                    value={bugFormData.title}
                    onChange={(e) => setBugFormData({ ...bugFormData, title: e.target.value })}
                    disabled={isCreatingBug}
                    required
                  />
                </div>

                <div className="form-row-2">
                  <div className="form-group">
                    <label htmlFor="bug-severity">Severity</label>
                    <select
                      id="bug-severity"
                      value={bugFormData.severity}
                      onChange={(e) => setBugFormData({ ...bugFormData, severity: e.target.value })}
                      disabled={isCreatingBug}
                    >
                      <option value="critical">Critical (Blocker)</option>
                      <option value="high">High (Major fault)</option>
                      <option value="medium">Medium (Standard defect)</option>
                      <option value="low">Low (Minor flaw)</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="bug-priority">Priority</label>
                    <select
                      id="bug-priority"
                      value={bugFormData.priority}
                      onChange={(e) => setBugFormData({ ...bugFormData, priority: e.target.value })}
                      disabled={isCreatingBug}
                    >
                      <option value="urgent">Urgent</option>
                      <option value="high">High</option>
                      <option value="medium">Medium</option>
                      <option value="low">Low</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="bug-assigned">Assign To (Optional)</label>
                  <select
                    id="bug-assigned"
                    value={bugFormData.assignedTo}
                    onChange={(e) => setBugFormData({ ...bugFormData, assignedTo: e.target.value })}
                    disabled={isCreatingBug}
                  >
                    <option value="">-- Unassigned (Triage Queue) --</option>
                    {assignableUsers.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name} ({u.email}) - {roleLabels[u.role] || u.role}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="bug-desc">Detailed Description & Steps to Reproduce *</label>
                  <textarea
                    id="bug-desc"
                    rows="4"
                    placeholder="Steps to reproduce, expected vs actual behavior, environment..."
                    value={bugFormData.description}
                    onChange={(e) => setBugFormData({ ...bugFormData, description: e.target.value })}
                    disabled={isCreatingBug}
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateBugModal(false)}
                    className="btn-secondary"
                    disabled={isCreatingBug}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-submit-bug"
                    disabled={isCreatingBug}
                  >
                    {isCreatingBug ? 'Submitting...' : 'Report Bug'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Create Change Request Modal */}
        {showCreateCRModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Submit Configuration Change Request</h3>
                <button
                  onClick={() => setShowCreateCRModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {crError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{crError}</span>
                </div>
              )}

              <form onSubmit={handleCreateChangeRequest} className="modal-form">
                <div className="form-group">
                  <label htmlFor="cr-title">Change Title *</label>
                  <input
                    id="cr-title"
                    type="text"
                    placeholder="e.g. Upgrade Database Schema to Support OAuth2"
                    value={crFormData.title}
                    onChange={(e) => setCrFormData({ ...crFormData, title: e.target.value })}
                    disabled={isCreatingCR}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cr-priority">Priority Level</label>
                  <select
                    id="cr-priority"
                    value={crFormData.priority}
                    onChange={(e) => setCrFormData({ ...crFormData, priority: e.target.value })}
                    disabled={isCreatingCR}
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="cr-reason">Business Justification / Reason *</label>
                  <textarea
                    id="cr-reason"
                    rows="2"
                    placeholder="Why is this change necessary? What business value or risk does it address?"
                    value={crFormData.reason}
                    onChange={(e) => setCrFormData({ ...crFormData, reason: e.target.value })}
                    disabled={isCreatingCR}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="cr-desc">Detailed Description & Proposed Scope *</label>
                  <textarea
                    id="cr-desc"
                    rows="4"
                    placeholder="Describe specific modifications, affected components, and rollback considerations..."
                    value={crFormData.description}
                    onChange={(e) => setCrFormData({ ...crFormData, description: e.target.value })}
                    disabled={isCreatingCR}
                    required
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateCRModal(false)}
                    className="btn-secondary"
                    disabled={isCreatingCR}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-submit-cr"
                    disabled={isCreatingCR}
                  >
                    {isCreatingCR ? 'Submitting...' : 'Submit Change Request'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Edit Project Modal */}
        {showEditModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Edit Project Configuration</h3>
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
                <div className="form-group">
                  <label htmlFor="edit-name">Project Name *</label>
                  <input
                    id="edit-name"
                    name="name"
                    type="text"
                    value={editFormData.name}
                    onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                    disabled={isUpdating}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-key">Project Key *</label>
                  <input
                    id="edit-key"
                    name="key"
                    type="text"
                    value={editFormData.key}
                    onChange={(e) => setEditFormData({ ...editFormData, key: e.target.value.toUpperCase() })}
                    disabled={isUpdating}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-desc">Description</label>
                  <textarea
                    id="edit-desc"
                    name="description"
                    rows="3"
                    value={editFormData.description}
                    onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
                    disabled={isUpdating}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-status">Status</label>
                  <select
                    id="edit-status"
                    name="status"
                    value={editFormData.status}
                    onChange={(e) => setEditFormData({ ...editFormData, status: e.target.value })}
                    disabled={isUpdating}
                  >
                    <option value="planning">Planning</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                    <option value="archived">Archived</option>
                  </select>
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
                    id="btn-save-project-edit"
                    disabled={isUpdating}
                  >
                    {isUpdating ? 'Saving Changes...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Project Confirmation Modal */}
        {showDeleteModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Confirm Project Deletion</h3>
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
                  Are you sure you want to delete <strong>{project.name}</strong> (<code>{project.key}</code>)?
                </p>
                <p className="warning-text">
                  This action will permanently remove this project configuration and its associated version baselines from the database.
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
                  onClick={handleDeleteProject}
                  className="btn-danger"
                  id="btn-confirm-delete"
                >
                  Yes, Delete Project
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Release Modal */}
        {showCreateReleaseModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Create Application Release</h3>
                <button
                  onClick={() => setShowCreateReleaseModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {releaseError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{releaseError}</span>
                </div>
              )}

              <form onSubmit={handleCreateRelease} className="modal-form">
                <div className="form-group">
                  <label htmlFor="rel-version">Target Software Version *</label>
                  <select
                    id="rel-version"
                    value={releaseFormData.version}
                    onChange={(e) => setReleaseFormData({ ...releaseFormData, version: e.target.value })}
                    disabled={isCreatingRelease}
                    required
                  >
                    <option value="">-- Select Version Baseline --</option>
                    {versions.map((v) => (
                      <option key={v._id} value={v._id}>
                        v{v.versionNumber} — {v.name} ({v.status})
                      </option>
                    ))}
                  </select>
                  {versions.length === 0 && (
                    <span className="form-hint" style={{ color: '#b91c1c' }}>
                      No versions registered yet. Please create a software version before publishing a release.
                    </span>
                  )}
                </div>

                <div className="form-group">
                  <label htmlFor="rel-name">Release Name *</label>
                  <input
                    id="rel-name"
                    type="text"
                    placeholder="e.g. Smart SCM v1.0.0 Production GA"
                    value={releaseFormData.releaseName}
                    onChange={(e) => setReleaseFormData({ ...releaseFormData, releaseName: e.target.value })}
                    disabled={isCreatingRelease}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rel-date">Target Release Date</label>
                  <input
                    id="rel-date"
                    type="date"
                    value={releaseFormData.releaseDate}
                    onChange={(e) => setReleaseFormData({ ...releaseFormData, releaseDate: e.target.value })}
                    disabled={isCreatingRelease}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="rel-desc">Release Summary / Scope</label>
                  <textarea
                    id="rel-desc"
                    rows="3"
                    placeholder="Key release goals, target audience, and deployment context..."
                    value={releaseFormData.description}
                    onChange={(e) => setReleaseFormData({ ...releaseFormData, description: e.target.value })}
                    disabled={isCreatingRelease}
                  />
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    onClick={() => setShowCreateReleaseModal(false)}
                    className="btn-secondary"
                    disabled={isCreatingRelease}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-submit-release"
                    disabled={isCreatingRelease || versions.length === 0}
                  >
                    {isCreatingRelease ? 'Creating...' : 'Create Release'}
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

export default ProjectDetails;
