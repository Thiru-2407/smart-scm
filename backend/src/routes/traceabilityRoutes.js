const express = require('express');
const router = express.Router();
const {
  getTraceabilityData,
  createTraceabilityLink
} = require('../controllers/traceabilityController');
const { protect } = require('../middleware/authMiddleware');

// Base route: /api/traceability
router.use(protect);

router.get('/', getTraceabilityData);
router.post('/link', createTraceabilityLink);

module.exports = router;
