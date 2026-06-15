// middleware/auth.js
// JWT verification middleware — protects routes that require a logged-in user.

const jwt = require('jsonwebtoken');
const User = require('../models/User');

// ── Verify JWT from cookie or Authorization header ──────────────────────────
const protect = async (req, res, next) => {
  try {
    // 1. Extract token: prefer HttpOnly cookie, fall back to Bearer header
    let token = req.cookies?.token;

    if (!token && req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, message: 'Not authenticated. Please log in.' });
    }

    // 2. Verify signature & expiry
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 3. Confirm user still exists in DB (handles deleted accounts)
    const user = await User.findById(decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }

    // 4. Attach user to request for use in controllers
    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError')  return res.status(401).json({ success: false, message: 'Invalid token.' });
    if (err.name === 'TokenExpiredError') return res.status(401).json({ success: false, message: 'Token expired. Please log in again.' });
    next(err);
  }
};

// ── Role-Based Access Control ────────────────────────────────────────────────
// Usage: requireRole('employer')  or  requireRole('job_seeker')
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Not authenticated.' });
  }
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: `Access denied. This action requires one of: ${roles.join(', ')}.`,
    });
  }
  next();
};

// ── Optional Auth ────────────────────────────────────────────────────────────
// Decodes token if present but does NOT block unauthenticated requests.
// Use on public pages that have optional personalisation (e.g. show "saved" state).
const optionalAuth = async (req, res, next) => {
  try {
    const token = req.cookies?.token ||
      (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.split(' ')[1] : null);

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.id);
    }
  } catch {
    // Invalid / expired token — treat as unauthenticated, do not error
    req.user = null;
  }
  next();
};

module.exports = { protect, requireRole, optionalAuth };
