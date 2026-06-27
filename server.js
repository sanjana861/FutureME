const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const { initDb } = require('./database/init');
const authRoutes = require('./routes/auth');
const profileRoutes = require('./routes/profile');
const taskRoutes = require('./routes/tasks');
const projectRoutes = require('./routes/projects');
const mentorRoutes = require('./routes/mentor');
const letterRoutes = require('./routes/letters');
const exportRoutes = require('./routes/export');
const historyRoutes = require('./routes/history');
const settingsRoutes = require('./routes/settings');

const app = express();
const PORT = process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Ensure upload directory exists
const uploadDir = path.resolve(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve uploaded files statically
app.use('/uploads', express.static(uploadDir));

// Serve static frontend files
app.use(express.static(path.resolve(__dirname, 'public')));

// Register API Routes
app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/mentor', mentorRoutes);
app.use('/api/letters', letterRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/settings', settingsRoutes);

// Fallback to serving index.html for unknown routes to support client routing if needed
app.get('*', (req, res, next) => {
  // If requesting api, let it pass to 404 handler
  if (req.url.startsWith('/api/')) return next();
  res.sendFile(path.resolve(__dirname, 'public', 'index.html'));
});

// 404 Route handler for API
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: 'Requested API endpoint not found.' });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Server encountered an internal system error.'
  });
});

// Initialize DB and start server
async function startServer() {
  try {
    await initDb();
    app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(` FUTUREME OS ACTIVE ON PORT ${PORT}`);
      console.log(` Open http://localhost:${PORT} in your browser`);
      console.log(`=================================================`);
    });
  } catch (error) {
    console.error('Failed to start FutureMe OS server:', error);
    process.exit(1);
  }
}

startServer();
