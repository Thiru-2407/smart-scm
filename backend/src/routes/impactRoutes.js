const express = require('express');
const router = express.Router();
const { getImpactAnalysis, getChangeRequestImpact } = require('../controllers/impactController');
const { protect } = require('../middleware/authMiddleware');

// Route for getting impact analysis list and overview
router.get('/', protect, getImpactAnalysis);

// Route for getting detailed impact analysis for a specific change request
router.get('/change-request/:changeRequestId', protect, getChangeRequestImpact);

module.exports = router;
