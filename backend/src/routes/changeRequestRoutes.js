const express = require('express');
const router = express.Router({ mergeParams: true });
const {
  createChangeRequest,
  getChangeRequests,
  getChangeRequestById,
  updateChangeRequest,
  reviewChangeRequest,
  deleteChangeRequest
} = require('../controllers/changeRequestController');
const { protect } = require('../middleware/authMiddleware');

router.use(protect);

router.route('/')
  .post(createChangeRequest)
  .get(getChangeRequests);

router.route('/:changeRequestId')
  .get(getChangeRequestById)
  .put(updateChangeRequest)
  .delete(deleteChangeRequest);

router.put('/:changeRequestId/review', reviewChangeRequest);

module.exports = router;
