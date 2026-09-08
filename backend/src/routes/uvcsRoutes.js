const express = require('express');
const router = express.Router();
const {
  getUVCSStatus,
  getUVCSBranches,
  getUVCSChangesets,
  getUVCSChangesetDetails,
  getWorkspaceChanges
} = require('../controllers/uvcsController');
const { protect } = require('../middleware/authMiddleware');

// All UVCS routes require authentication
router.use(protect);

router.get('/status', getUVCSStatus);
router.get('/branches', getUVCSBranches);
router.get('/changesets', getUVCSChangesets);
router.get('/changesets/:id', getUVCSChangesetDetails);
router.get('/workspace-changes', getWorkspaceChanges);

module.exports = router;
