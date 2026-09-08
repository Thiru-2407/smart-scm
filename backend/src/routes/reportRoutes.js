const express = require('express');
const router = express.Router();
const {
  getOverviewReport,
  getProjectReport,
  getProjectQualityReport,
  getProjectReleasesReport
} = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

// All report endpoints are protected with JWT authentication
router.get('/overview', protect, getOverviewReport);
router.get('/projects/:projectId', protect, getProjectReport);
router.get('/projects/:projectId/quality', protect, getProjectQualityReport);
router.get('/projects/:projectId/releases', protect, getProjectReleasesReport);

module.exports = router;
