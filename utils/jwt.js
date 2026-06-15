// utils/jwt.js
// Centralise token generation and cookie attachment.

const jwt = require('jsonwebtoken');

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

// Attach JWT as an HttpOnly cookie (XSS-safe) and return payload in body too
const sendTokenResponse = (res, user, statusCode = 200) => {
  const token = generateToken(user);

  const cookieOptions = {
    httpOnly: true,                      // JS cannot read this cookie — XSS protection
    secure: process.env.NODE_ENV === 'production',  // HTTPS only in prod
    sameSite: 'strict',                  // CSRF protection
    maxAge: 7 * 24 * 60 * 60 * 1000,   // 7 days in ms
  };

  res.cookie('token', token, cookieOptions);

  return res.status(statusCode).json({
    success: true,
    token,      // also sent in body for API clients / localStorage fallback
    user: {
      id:    user.id,
      name:  user.name,
      email: user.email,
      role:  user.role,
    },
  });
};

module.exports = { generateToken, sendTokenResponse };
