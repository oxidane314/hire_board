// controllers/authController.js
// Handles register, login, logout, and profile fetch.
// Controllers call Models and send HTTP responses — they don't contain SQL.

const User = require('../models/User');
const { sendTokenResponse } = require('../utils/jwt');

// POST /api/auth/register
const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;

    // Check for duplicate email (also caught by DB unique constraint, but this gives a nicer message)
    const existing = await User.findByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: 'An account with this email already exists.' });
    }

    const user = await User.create({ name, email, password, role });

    sendTokenResponse(res, user, 201);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/login
const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Fetch user including password_hash (findByEmail returns the full row)
    const user = await User.findByEmail(email);
    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    const isMatch = await User.verifyPassword(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid email or password.' });
    }

    sendTokenResponse(res, user, 200);
  } catch (err) {
    next(err);
  }
};

// POST /api/auth/logout
const logout = (req, res) => {
  res.cookie('token', '', {
    httpOnly: true,
    expires: new Date(0), // immediately expired
  });
  res.json({ success: true, message: 'Logged out successfully.' });
};

// GET /api/auth/me
const getMe = async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    res.json({ success: true, user });
  } catch (err) {
    next(err);
  }
};

// PUT /api/auth/profile
const updateProfile = async (req, res, next) => {
  try {
    const { name, bio } = req.body;
    const updated = await User.update(req.user.id, { name, bio });
    res.json({ success: true, user: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { register, login, logout, getMe, updateProfile };
