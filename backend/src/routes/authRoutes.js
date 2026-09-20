const express = require('express');
const router = express.Router();
const {
  register,
  login,
  getCurrentUser,
  googleLogin,
  getAuthConfig,
  getUsers,
  updateUserRole,
  switchDemoRole
} = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);
router.post('/google', googleLogin);
router.get('/config', getAuthConfig);

// Protected routes
router.get('/me', protect, getCurrentUser);
router.get('/users', protect, getUsers);
router.put('/users/:id/role', protect, updateUserRole);
router.put('/demo-role', protect, switchDemoRole);

module.exports = router;
