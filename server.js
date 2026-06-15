// server.js — Entry point for the Job Board Express application

require('dotenv').config();
const express    = require('express');
const path       = require('path');
const cookieParser = require('cookie-parser');

const { testConnection } = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// ── Routes ────────────────────────────────────────────────────────────────────
const authRoutes        = require('./routes/auth');
const jobRoutes         = require('./routes/jobs');
const applicationRoutes = require('./routes/applications');
const savedJobRoutes    = require('./routes/savedJobs');

const app = express();

// ── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());                       // Parse JSON request bodies
app.use(express.urlencoded({ extended: true })); // Parse form bodies
app.use(cookieParser());                       // Parse HttpOnly JWT cookie

// Security headers (minimal — use helmet in production)
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  next();
});

// ── Serve static frontend files ───────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

// ── API Routes ────────────────────────────────────────────────────────────────
app.use('/api/auth',         authRoutes);
app.use('/api/jobs',         jobRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/saved-jobs',   savedJobRoutes);

// ── SPA fallback: serve index.html for all non-API GET routes ─────────────────
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ── Centralised error handler (must be last) ──────────────────────────────────
app.use(errorHandler);

// ── Start server ──────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

const start = async () => {
  await testConnection(); // Fail fast if DB is unreachable
  app.listen(PORT, () => {
    console.log(`\n🚀 Job Board server running at http://localhost:${PORT}`);
    console.log(`   Environment : ${process.env.NODE_ENV}`);
    console.log(`   API base    : http://localhost:${PORT}/api\n`);
  });
};

start();
