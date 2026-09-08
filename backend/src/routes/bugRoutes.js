const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  createBug,
  getBugs,
  getBugById,
  updateBug,
  assignBug,
  deleteBug
} = require('../controllers/bugController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(createBug)
  .get(getBugs);

router.route('/:bugId')
  .get(getBugById)
  .put(updateBug)
  .delete(deleteBug);

router.put('/:bugId/assign', assignBug);

module.exports = router;
