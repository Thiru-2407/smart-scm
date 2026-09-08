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
app.use(cors());
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
    message: 'Smart SCM API is running'
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

// Port configuration
const PORT = process.env.PORT || 5000;

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = { app, server };
