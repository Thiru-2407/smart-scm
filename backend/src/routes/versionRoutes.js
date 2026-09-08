const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  createVersion,
  getVersions,
  getVersionById,
  updateVersion,
  deleteVersion,
  linkUvcsBaseline
} = require('../controllers/versionController');
const { protect } = require('../middleware/authMiddleware');

// All version routes require authentication
router.use(protect);

router.route('/')
  .post(createVersion)
  .get(getVersions);

router.route('/:versionId')
  .get(getVersionById)
  .put(updateVersion)
  .delete(deleteVersion);

router.put('/:versionId/link-uvcs', linkUvcsBaseline);

module.exports = router;
