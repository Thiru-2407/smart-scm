const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Helper to generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE || '24h'
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Validate required fields
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide name, email, and password'
      });
    }

    // Basic email format check
    const emailRegex = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid email address'
      });
    }

    // Check if role is valid if provided
    const validRoles = ['admin', 'project_manager', 'developer', 'tester'];
    if (role && !validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${validRoles.join(', ')}`
      });
    }

    // Check for duplicate user
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User already exists with this email address'
      });
    }

    // Security: Public registrations always receive the safe default role 'developer'.
    // Privileged roles (admin, project_manager, tester) cannot be self-assigned.
    const user = await User.create({
      name,
      email: email.toLowerCase(),
      password,
      role: 'developer',
      authProvider: 'local'
    });

    // Generate token
    const token = generateToken(user._id);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during registration'
    });
  }
};

// @desc    Login user & get token
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate inputs
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Check user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Verify password
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate token
    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during login'
    });
  }
};

// @desc    Get currently authenticated user
// @route   GET /api/auth/me
// @access  Private
const getCurrentUser = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      user: {
        id: req.user._id,
        name: req.user.name,
        email: req.user.email,
        role: req.user.role
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error retrieving current user'
    });
  }
};

const googleAuthService = require('../services/googleAuthService');

// @desc    Authenticate with Google OAuth ID Token
// @route   POST /api/auth/google
// @access  Public
const googleLogin = async (req, res) => {
  try {
    const { credential, idToken } = req.body;
    const tokenToVerify = credential || idToken;

    if (!tokenToVerify) {
      return res.status(400).json({
        success: false,
        message: 'Google ID token credential is required'
      });
    }

    if (!googleAuthService.isGoogleAuthConfigured()) {
      return res.status(400).json({
        success: false,
        message: 'Google authentication is not configured on the server. Please set GOOGLE_CLIENT_ID.'
      });
    }

    let payload;
    try {
      payload = await googleAuthService.verifyGoogleIdToken(tokenToVerify);
    } catch (verifyError) {
      return res.status(401).json({
        success: false,
        message: verifyError.message || 'Google token verification failed'
      });
    }

    // Check if user already exists with this email
    let user = await User.findOne({ email: payload.email });

    if (user) {
      // Existing user: Link googleId and avatar if not yet set
      let needsSave = false;
      if (!user.googleId && payload.googleId) {
        user.googleId = payload.googleId;
        needsSave = true;
      }
      if (payload.picture && !user.avatar) {
        user.avatar = payload.picture;
        needsSave = true;
      }
      if (needsSave) {
        await user.save();
      }
    } else {
      // New user: Create user with safe default role 'developer'
      user = await User.create({
        name: payload.name,
        email: payload.email,
        role: 'developer',
        authProvider: 'google',
        googleId: payload.googleId,
        avatar: payload.picture
      });
    }

    const token = generateToken(user._id);

    return res.status(200).json({
      success: true,
      message: 'Google authentication successful',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error during Google authentication'
    });
  }
};

// @desc    Get public auth configuration status
// @route   GET /api/auth/config
// @access  Public
const getAuthConfig = async (req, res) => {
  return res.status(200).json({
    success: true,
    googleAuthEnabled: googleAuthService.isGoogleAuthConfigured(),
    firebaseProjectId: process.env.FIREBASE_PROJECT_ID || null,
    clientId: googleAuthService.isGoogleAuthConfigured() ? (process.env.GOOGLE_CLIENT_ID || process.env.FIREBASE_PROJECT_ID) : null
  });
};

// @desc    Update user role (Admin only)
// @route   PUT /api/auth/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Only authorized administrators can update user roles'
      });
    }

    const { role } = req.body;
    const validRoles = ['admin', 'project_manager', 'developer', 'tester'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Invalid role. Allowed roles: ${validRoles.join(', ')}`
      });
    }

    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    user.role = role;
    await user.save();

    return res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || 'Server error updating user role'
    });
  }
};

module.exports = {
  register,
  login,
  getCurrentUser,
  googleLogin,
  getAuthConfig,
  updateUserRole
};
