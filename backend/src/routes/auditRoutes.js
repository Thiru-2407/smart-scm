const express = require('express');
const router = express.Router();
const { getAuditLogs, getProjectAuditLogs } = require('../controllers/auditController');
const { protect } = require('../middleware/authMiddleware');

// All audit routes require authentication
router.use(protect);

router.get('/', getAuditLogs);
router.get('/project/:projectId', getProjectAuditLogs);

module.exports = router;
