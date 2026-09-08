const express = require('express');
const router = express.Router();
const { getReleaseReadiness, getReleaseReadinessByRelease } = require('../controllers/readinessController');
const { protect } = require('../middleware/authMiddleware');

// Route for getting release readiness list and overview
router.get('/', protect, getReleaseReadiness);

// Route for getting detailed readiness evaluation for a specific release
router.get('/release/:releaseId', protect, getReleaseReadinessByRelease);

module.exports = router;
