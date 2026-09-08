const rawBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const cleanBaseUrl = rawBaseUrl.replace(/\/+$/, '');
const API_BASE_URL = cleanBaseUrl.endsWith('/api')
  ? cleanBaseUrl
  : `${cleanBaseUrl}/api`;

/**
 * Common fetch wrapper with automatic JWT token attachment and error handling
 */
async function request(endpoint, options = {}) {
  const token = localStorage.getItem('smart_scm_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token && { Authorization: `Bearer ${token}` }),
    ...options.headers
  };

  const config = {
    ...options,
    headers
  };

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);

    // Read response as text first to handle non-JSON responses gracefully
    const rawText = await response.text();
    let data;
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: rawText || `HTTP Error ${response.status}` };
    }

    if (!response.ok) {
      const error = new Error(data?.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = data;
      throw error;
    }

    return data;
  } catch (error) {
    if (!error.status) {
      error.message = 'Unable to connect to the backend server. Please ensure the API is running.';
    }
    throw error;
  }
}

export const authService = {
  login: async (email, password) => {
    return await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
  },

  register: async (name, email, password, role) => {
    return await request('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, role })
    });
  },

  getCurrentUser: async () => {
    return await request('/auth/me', {
      method: 'GET'
    });
  }
};

export const projectService = {
  getProjects: async () => {
    return await request('/projects', { method: 'GET' });
  },

  getProjectStats: async () => {
    return await request('/projects/stats/summary', { method: 'GET' });
  },

  getProjectById: async (id) => {
    return await request(`/projects/${id}`, { method: 'GET' });
  },

  createProject: async (projectData) => {
    return await request('/projects', {
      method: 'POST',
      body: JSON.stringify(projectData)
    });
  },

  updateProject: async (id, projectData) => {
    return await request(`/projects/${id}`, {
      method: 'PUT',
      body: JSON.stringify(projectData)
    });
  },

  deleteProject: async (id) => {
    return await request(`/projects/${id}`, {
      method: 'DELETE'
    });
  },

  addMember: async (id, userId) => {
    return await request(`/projects/${id}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId })
    });
  },

  removeMember: async (id, userId) => {
    return await request(`/projects/${id}/members/${userId}`, {
      method: 'DELETE'
    });
  },

  getAvailableUsers: async () => {
    return await request('/projects/users/available', { method: 'GET' });
  }
};

export const versionService = {
  getVersions: async (projectId) => {
    return await request(`/projects/${projectId}/versions`, { method: 'GET' });
  },

  getVersionById: async (projectId, versionId) => {
    return await request(`/projects/${projectId}/versions/${versionId}`, { method: 'GET' });
  },

  createVersion: async (projectId, versionData) => {
    return await request(`/projects/${projectId}/versions`, {
      method: 'POST',
      body: JSON.stringify(versionData)
    });
  },

  updateVersion: async (projectId, versionId, versionData) => {
    return await request(`/projects/${projectId}/versions/${versionId}`, {
      method: 'PUT',
      body: JSON.stringify(versionData)
    });
  },

  deleteVersion: async (projectId, versionId) => {
    return await request(`/projects/${projectId}/versions/${versionId}`, {
      method: 'DELETE'
    });
  },

  linkUvcs: async (projectId, versionId, uvcsData) => {
    return await request(`/projects/${projectId}/versions/${versionId}/link-uvcs`, {
      method: 'PUT',
      body: JSON.stringify(uvcsData)
    });
  },

  getVersionStats: async () => {
    return await request('/versions/stats/summary', { method: 'GET' });
  }
};

export const bugService = {
  getBugs: async (projectId) => {
    return await request(`/projects/${projectId}/bugs`, { method: 'GET' });
  },

  getBugById: async (projectId, bugId) => {
    return await request(`/projects/${projectId}/bugs/${bugId}`, { method: 'GET' });
  },

  createBug: async (projectId, bugData) => {
    return await request(`/projects/${projectId}/bugs`, {
      method: 'POST',
      body: JSON.stringify(bugData)
    });
  },

  updateBug: async (projectId, bugId, bugData) => {
    return await request(`/projects/${projectId}/bugs/${bugId}`, {
      method: 'PUT',
      body: JSON.stringify(bugData)
    });
  },

  assignBug: async (projectId, bugId, assignedTo) => {
    return await request(`/projects/${projectId}/bugs/${bugId}/assign`, {
      method: 'PUT',
      body: JSON.stringify({ assignedTo })
    });
  },

  deleteBug: async (projectId, bugId) => {
    return await request(`/projects/${projectId}/bugs/${bugId}`, {
      method: 'DELETE'
    });
  },

  getBugStats: async () => {
    return await request('/bugs/stats/summary', { method: 'GET' });
  }
};

export const changeRequestService = {
  getChangeRequests: async (projectId) => {
    return await request(`/projects/${projectId}/change-requests`, { method: 'GET' });
  },

  getChangeRequestById: async (projectId, crId) => {
    return await request(`/projects/${projectId}/change-requests/${crId}`, { method: 'GET' });
  },

  createChangeRequest: async (projectId, crData) => {
    return await request(`/projects/${projectId}/change-requests`, {
      method: 'POST',
      body: JSON.stringify(crData)
    });
  },

  updateChangeRequest: async (projectId, crId, crData) => {
    return await request(`/projects/${projectId}/change-requests/${crId}`, {
      method: 'PUT',
      body: JSON.stringify(crData)
    });
  },

  reviewChangeRequest: async (projectId, crId, reviewData) => {
    return await request(`/projects/${projectId}/change-requests/${crId}/review`, {
      method: 'PUT',
      body: JSON.stringify(reviewData)
    });
  },

  deleteChangeRequest: async (projectId, crId) => {
    return await request(`/projects/${projectId}/change-requests/${crId}`, {
      method: 'DELETE'
    });
  },

  getChangeRequestStats: async () => {
    return await request('/change-requests/stats/summary', { method: 'GET' });
  }
};

export const releaseService = {
  getReleases: async (projectId) => {
    return await request(`/projects/${projectId}/releases`, { method: 'GET' });
  },

  getReleaseById: async (projectId, releaseId) => {
    return await request(`/projects/${projectId}/releases/${releaseId}`, { method: 'GET' });
  },

  createRelease: async (projectId, releaseData) => {
    return await request(`/projects/${projectId}/releases`, {
      method: 'POST',
      body: JSON.stringify(releaseData)
    });
  },

  updateRelease: async (projectId, releaseId, releaseData) => {
    return await request(`/projects/${projectId}/releases/${releaseId}`, {
      method: 'PUT',
      body: JSON.stringify(releaseData)
    });
  },

  approveRelease: async (projectId, releaseId) => {
    return await request(`/projects/${projectId}/releases/${releaseId}/approve`, {
      method: 'PUT'
    });
  },

  publishRelease: async (projectId, releaseId) => {
    return await request(`/projects/${projectId}/releases/${releaseId}/publish`, {
      method: 'PUT'
    });
  },

  generateReleaseNotes: async (projectId, releaseId) => {
    return await request(`/projects/${projectId}/releases/${releaseId}/generate-notes`, {
      method: 'POST'
    });
  },

  deleteRelease: async (projectId, releaseId) => {
    return await request(`/projects/${projectId}/releases/${releaseId}`, {
      method: 'DELETE'
    });
  },

  linkUvcs: async (projectId, releaseId, uvcsData) => {
    return await request(`/projects/${projectId}/releases/${releaseId}/link-uvcs`, {
      method: 'PUT',
      body: JSON.stringify(uvcsData)
    });
  },

  getReleaseStats: async () => {
    return await request('/releases/stats/summary', { method: 'GET' });
  },

  getRecentReleases: async () => {
    return await request('/releases/recent', { method: 'GET' });
  }
};

export const reportService = {
  getOverview: async () => {
    return await request('/reports/overview', { method: 'GET' });
  },

  getProjectReport: async (projectId) => {
    return await request(`/reports/projects/${projectId}`, { method: 'GET' });
  },

  getProjectQuality: async (projectId) => {
    return await request(`/reports/projects/${projectId}/quality`, { method: 'GET' });
  },

  getProjectReleases: async (projectId) => {
    return await request(`/reports/projects/${projectId}/releases`, { method: 'GET' });
  }
};

export const uvcsService = {
  getStatus: async () => {
    return await request('/uvcs/status', { method: 'GET' });
  },

  getBranches: async (repository) => {
    const query = repository ? `?repository=${encodeURIComponent(repository)}` : '';
    return await request(`/uvcs/branches${query}`, { method: 'GET' });
  },

  getChangesets: async (repository) => {
    const query = repository ? `?repository=${encodeURIComponent(repository)}` : '';
    return await request(`/uvcs/changesets${query}`, { method: 'GET' });
  },

  getChangesetById: async (id, repository) => {
    const query = repository ? `?repository=${encodeURIComponent(repository)}` : '';
    return await request(`/uvcs/changesets/${id}${query}`, { method: 'GET' });
  },

  getWorkspaceChanges: async () => {
    return await request('/uvcs/workspace-changes', { method: 'GET' });
  }
};

export const auditService = {
  getAuditLogs: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return await request(`/audit${queryString}`, { method: 'GET' });
  },

  getProjectAuditLogs: async (projectId, params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return await request(`/projects/${projectId}/audit${queryString}`, { method: 'GET' });
  }
};

export const traceabilityService = {
  getTraceability: async (params = {}) => {
    const queryParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        queryParams.append(key, value);
      }
    });
    const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
    return await request(`/traceability${queryString}`, { method: 'GET' });
  },

  linkArtifacts: async (data) => {
    return await request('/traceability/link', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};

export default {
  auth: authService,
  projects: projectService,
  versions: versionService,
  bugs: bugService,
  changeRequests: changeRequestService,
  releases: releaseService,
  reports: reportService,
  uvcs: uvcsService,
  audit: auditService,
  traceability: traceabilityService
};
