// routes/auth.js
const express = require('express');
const router = express.Router();

const { register, login, logout, getMe, updateProfile } = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { validateRegister, validateLogin } = require('../middleware/validate');

router.post('/register', validateRegister, register);
router.post('/login',    validateLogin,    login);
router.post('/logout',   logout);
router.get( '/me',       protect,          getMe);
router.put( '/profile',  protect,          updateProfile);

module.exports = router;
