import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { projectService } from '../services/api';

const statusLabels = {
  planning: 'Planning',
  active: 'Active',
  completed: 'Completed',
  archived: 'Archived'
};

const Projects = () => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    key: '',
    description: '',
    status: 'planning'
  });
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchProjects = async () => {
    try {
      setIsLoading(true);
      setErrorMessage('');
      const response = await projectService.getProjects();
      if (response.success) {
        setProjects(response.projects || []);
      }
    } catch (error) {
      setErrorMessage(error.message || 'Failed to load projects');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProjects();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: name === 'key' ? value.toUpperCase() : value
    }));
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim() || !formData.key.trim()) {
      setFormError('Please provide both a project name and project key.');
      return;
    }

    const keyRegex = /^[A-Z0-9_-]+$/;
    if (!keyRegex.test(formData.key.trim())) {
      setFormError('Project key can only contain uppercase letters, numbers, hyphens, and underscores.');
      return;
    }

    try {
      setIsSubmitting(true);
      const response = await projectService.createProject(formData);
      if (response.success && response.project) {
        setProjects((prev) => [response.project, ...prev]);
        setShowCreateModal(false);
        setFormData({
          name: '',
          key: '',
          description: '',
          status: 'planning'
        });
      }
    } catch (error) {
      setFormError(error.message || 'Failed to create project');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-layout">
      <Navbar />

      <main className="main-content">
        <div className="page-header-row">
          <div>
            <h1>Project Management</h1>
            <p className="subtitle">Manage software projects, repository mappings, and configuration baselines.</p>
          </div>
          <button
            onClick={() => {
              setFormError('');
              setShowCreateModal(true);
            }}
            className="btn-action-primary"
            id="btn-open-create-modal"
          >
            + New Project
          </button>
        </div>

        {/* Global Error Message */}
        {errorMessage && (
          <div className="alert-error" role="alert">
            <span className="alert-icon">⚠️</span>
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="modal-overlay">
            <div className="modal-card">
              <div className="modal-header">
                <h3>Create New Project</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="btn-modal-close"
                  type="button"
                >
                  &times;
                </button>
              </div>

              {formError && (
                <div className="alert-error modal-alert" role="alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{formError}</span>
                </div>
              )}

              <form onSubmit={handleCreateProject} className="modal-form">
                <div className="form-group">
                  <label htmlFor="proj-name">Project Name *</label>
                  <input
                    id="proj-name"
                    name="name"
                    type="text"
                    placeholder="e.g. Smart SCM Core Engine"
                    value={formData.name}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                    required
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="proj-key">Project Key *</label>
                  <input
                    id="proj-key"
                    name="key"
                    type="text"
                    placeholder="e.g. SCM-CORE"
                    value={formData.key}
                    onChange={handleInputChange}
                    maxLength={10}
                    disabled={isSubmitting}
                    required
                  />
                  <span className="form-hint">Unique identifier (2-10 uppercase alphanumeric chars, dashes, underscores).</span>
                </div>

                <div className="form-group">
                  <label htmlFor="proj-desc">Description</label>
                  <textarea
                    id="proj-desc"
                    name="description"
                    rows="3"
                    placeholder="Brief architectural purpose or scope of this project..."
                    value={formData.description}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="proj-status">Initial Status</label>
                  <select
                    id="proj-status"
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={isSubmitting}
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
                    onClick={() => setShowCreateModal(false)}
                    className="btn-secondary"
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn-primary-small"
                    id="btn-submit-project"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Creating Project...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Loading State */}
        {isLoading ? (
          <div className="page-loading-state">
            <div className="spinner"></div>
            <p>Loading projects portfolio...</p>
          </div>
        ) : projects.length === 0 ? (
          /* Empty State */
          <div className="empty-state-card" id="empty-projects-state">
            <div className="empty-icon">📁</div>
            <h3>No Projects Registered</h3>
            <p>Get started by creating your first software project for configuration management tracking.</p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="btn-action-primary"
            >
              Create First Project
            </button>
          </div>
        ) : (
          <div>
            {/* Primary Featured Project Showcase */}
            {(() => {
              const primaryProject = projects.find((p) => p.key === 'SMART-SCM') || projects[0];
              const otherProjects = projects.filter((p) => p._id !== primaryProject._id);

              return (
                <div>
                  <div
                    className="card primary-project-showcase"
                    style={{
                      marginBottom: otherProjects.length > 0 ? '2rem' : '0',
                      padding: '2rem',
                      border: '1px solid #c7d2fe',
                      background: 'linear-gradient(135deg, #ffffff 0%, #f8faff 100%)',
                      boxShadow: '0 4px 16px rgba(99, 102, 241, 0.08)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem' }}>
                      <div style={{ flex: '1 1 500px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.6rem', flexWrap: 'wrap' }}>
                          <span className="project-key-tag" style={{ fontSize: '0.9rem', padding: '0.25rem 0.6rem', fontWeight: '700' }}>
                            {primaryProject.key}
                          </span>
                          <span className={`status-pill status-${primaryProject.status}`} style={{ textTransform: 'capitalize', fontWeight: '600' }}>
                            {statusLabels[primaryProject.status] || primaryProject.status}
                          </span>
                          <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '0.2rem 0.55rem', background: '#e0e7ff', color: '#3730a3', borderRadius: '4px', letterSpacing: '0.04em' }}>
                            PRIMARY CONFIGURATION PROJECT
                          </span>
                        </div>

                        <h2 style={{ fontSize: '1.85rem', margin: '0 0 0.5rem 0', color: 'var(--text-color, #1e293b)', fontWeight: '700' }}>
                          {primaryProject.name}
                        </h2>

                        <p style={{ color: 'var(--text-muted, #64748b)', margin: '0 0 1.25rem 0', maxWidth: '680px', fontSize: '1rem', lineHeight: '1.5' }}>
                          {primaryProject.description || 'Smart Software Release & Version Tracking System for Configuration Management'}
                        </p>
                      </div>

                      <div style={{ alignSelf: 'center' }}>
                        <Link
                          to={`/projects/${primaryProject._id}`}
                          className="btn-action-primary"
                          id="btn-open-project"
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.8rem 1.6rem',
                            fontSize: '1rem',
                            fontWeight: '600',
                            textDecoration: 'none',
                            borderRadius: '8px',
                            boxShadow: '0 2px 8px rgba(79, 70, 229, 0.25)'
                          }}
                        >
                          Open Project &rarr;
                        </Link>
                      </div>
                    </div>

                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                        gap: '1.25rem',
                        borderTop: '1px solid #e2e8f0',
                        paddingTop: '1.25rem',
                        marginTop: '1rem'
                      }}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Owner</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: '600', marginTop: '0.2rem' }}>{primaryProject.owner?.name || 'Project Lead'}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Configuration Standard</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: '600', marginTop: '0.2rem', color: '#4338ca' }}>IEEE 828 / ISO 26262</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Unity Version Control</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: '600', marginTop: '0.2rem' }}>default@local (/main)</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '0.72rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Team Access</span>
                        <span style={{ fontSize: '0.95rem', fontWeight: '600', marginTop: '0.2rem' }}>
                          {(primaryProject.members?.length || 0) + 1} {((primaryProject.members?.length || 0) + 1) === 1 ? 'Member' : 'Members'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Secondary Portfolio Grid (if multiple projects exist) */}
                  {otherProjects.length > 0 && (
                    <div style={{ marginTop: '2rem' }}>
                      <h3 style={{ marginBottom: '1rem', fontSize: '1.2rem', color: 'var(--text-color, #1e293b)' }}>
                        Additional Projects Portfolio ({otherProjects.length})
                      </h3>
                      <div className="table-responsive card">
                        <table className="data-table">
                          <thead>
                            <tr>
                              <th>Project Key</th>
                              <th>Name</th>
                              <th>Status</th>
                              <th>Owner</th>
                              <th>Team Members</th>
                              <th>Created</th>
                              <th>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {otherProjects.map((proj) => (
                              <tr key={proj._id} className="project-row" data-project-key={proj.key}>
                                <td>
                                  <span className="project-key-tag">{proj.key}</span>
                                </td>
                                <td>
                                  <Link to={`/projects/${proj._id}`} className="project-title-link">
                                    {proj.name}
                                  </Link>
                                  {proj.description && (
                                    <p className="project-desc-excerpt">{proj.description}</p>
                                  )}
                                </td>
                                <td>
                                  <span className={`status-pill status-${proj.status}`}>
                                    {statusLabels[proj.status] || proj.status}
                                  </span>
                                </td>
                                <td>
                                  <span className="owner-name">{proj.owner?.name || 'Unknown'}</span>
                                </td>
                                <td>
                                  <span className="member-count-badge">
                                    {(proj.members?.length || 0) + 1} {((proj.members?.length || 0) + 1) === 1 ? 'member' : 'members'}
                                  </span>
                                </td>
                                <td>
                                  <span className="date-text">
                                    {new Date(proj.createdAt).toLocaleDateString()}
                                  </span>
                                </td>
                                <td>
                                  <Link
                                    to={`/projects/${proj._id}`}
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
                    </div>
                  )}
                </div>
              );
            })()}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Projects;
