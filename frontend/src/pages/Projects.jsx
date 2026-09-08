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
          /* Projects Table / Grid */
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
                {projects.map((proj) => (
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
        )}
      </main>

      <Footer />
    </div>
  );
};

export default Projects;
