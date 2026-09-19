const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getCurrentUser,
  googleLogin,
  getAuthConfig,
  updateUserRole
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/config', getAuthConfig);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.put('/users/:id/role', protect, updateUserRole);

module.exports = router;
