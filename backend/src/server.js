const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const connectDB = require('./config/db');

// Load environment variables
dotenv.config();

// Initialize Express app
const app = express();

// Connect to Database
connectDB();

// Middleware
// Allowed origins for CORS (development defaults + production environment configuration)
const defaultOrigins = [
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
];

const customOrigins = (process.env.FRONTEND_URL || process.env.CLIENT_URL || process.env.CORS_ORIGIN || '')
  .split(',')
  .map(url => url.trim().replace(/\/$/, ''))
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultOrigins, ...customOrigins])];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser requests (e.g. curl, server-to-server health checks, Postman, test runners)
    if (!origin) return callback(null, true);

    const normalizedOrigin = origin.replace(/\/$/, '');

    // Allow explicitly whitelisted origins
    if (allowedOrigins.includes(normalizedOrigin)) {
      return callback(null, true);
    }

    // In development mode, allow any localhost or 127.0.0.1 port
    if (process.env.NODE_ENV !== 'production' && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }

    const corsError = new Error(`CORS policy blocked access from origin '${origin}'. Configure FRONTEND_URL in backend environment.`);
    corsError.status = 403;
    return callback(corsError);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.use(express.json());

// Routes
const authRoutes = require('./routes/authRoutes');
const projectRoutes = require('./routes/projectRoutes');
const reportRoutes = require('./routes/reportRoutes');
const uvcsRoutes = require('./routes/uvcsRoutes');
const { getVersionStats } = require('./controllers/versionController');
const { getBugStats } = require('./controllers/bugController');
const { getChangeRequestStats } = require('./controllers/changeRequestController');
const { getReleaseStats, getRecentReleases } = require('./controllers/releaseController');
const { protect } = require('./middleware/authMiddleware');

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Smart SCM API is running',
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/uvcs', uvcsRoutes);
app.get('/api/versions/stats/summary', protect, getVersionStats);
app.get('/api/bugs/stats/summary', protect, getBugStats);
app.get('/api/change-requests/stats/summary', protect, getChangeRequestStats);
app.get('/api/releases/stats/summary', protect, getReleaseStats);
app.get('/api/releases/recent', protect, getRecentReleases);

// Port and Host configuration
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

// Start server
const server = app.listen(PORT, HOST, () => {
  console.log(`Server running on ${HOST}:${PORT} [Environment: ${process.env.NODE_ENV || 'development'}]`);
});

module.exports = { app, server };
