const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  createRelease,
  getReleases,
  getReleaseById,
  updateRelease,
  approveRelease,
  publishRelease,
  generateReleaseNotes,
  deleteRelease,
  linkUvcsBaseline
} = require('../controllers/releaseController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(createRelease)
  .get(getReleases);

router.route('/:releaseId')
  .get(getReleaseById)
  .put(updateRelease)
  .delete(deleteRelease);

router.put('/:releaseId/approve', approveRelease);
router.put('/:releaseId/publish', publishRelease);
router.post('/:releaseId/generate-notes', generateReleaseNotes);
router.put('/:releaseId/link-uvcs', linkUvcsBaseline);

module.exports = router;
