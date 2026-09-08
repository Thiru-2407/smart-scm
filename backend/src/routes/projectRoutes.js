const express = require('express');
const router = express.Router();
const {
  createProject,
  getProjects,
  getProjectStats,
  getProjectById,
  updateProject,
  deleteProject,
  addProjectMember,
  removeProjectMember,
  getAvailableUsers
} = require('../controllers/projectController');
const { protect } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// Statistics and user listings (placed before :id route)
router.get('/stats/summary', getProjectStats);
router.get('/users/available', getAvailableUsers);

// Collection routes
router.route('/')
  .get(getProjects)
  .post(createProject);

// Single project routes
router.route('/:id')
  .get(getProjectById)
  .put(updateProject)
  .delete(deleteProject);

// Member management
router.post('/:id/members', addProjectMember);
router.delete('/:id/members/:userId', removeProjectMember);

// Forward to nested version routes
const versionRoutes = require('./versionRoutes');
router.use('/:projectId/versions', versionRoutes);

// Forward to nested bug routes
const bugRoutes = require('./bugRoutes');
router.use('/:projectId/bugs', bugRoutes);

// Forward to nested change request routes
const changeRequestRoutes = require('./changeRequestRoutes');
router.use('/:projectId/change-requests', changeRequestRoutes);

// Forward to nested release routes
const releaseRoutes = require('./releaseRoutes');
router.use('/:projectId/releases', releaseRoutes);

module.exports = router;
