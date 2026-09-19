const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  getBaselines,
  getProjectBaselines,
  getBaselineById,
  createBaseline,
  freezeBaseline,
  updateBaseline,
  deleteBaseline,
  getBaselineStats
} = require('../controllers/baselineController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

// Global statistics route
router.get('/stats/summary', getBaselineStats);

// Project-nested vs Global listing and creation
router.route('/')
  .get((req, res, next) => {
    if (req.params.projectId) {
      return getProjectBaselines(req, res, next);
    }
    return getBaselines(req, res, next);
  })
  .post(createBaseline);

// Individual baseline operations
router.route('/:id')
  .get(getBaselineById)
  .put(updateBaseline)
  .delete(deleteBaseline);

// Freeze baseline
router.put('/:id/freeze', freezeBaseline);

module.exports = router;
