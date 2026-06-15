// routes/savedJobs.js
const express = require('express');
const router = express.Router();

const { getSavedJobs } = require('../controllers/savedJobController');
const { protect, requireRole } = require('../middleware/auth');

router.get('/', protect, requireRole('job_seeker'), getSavedJobs);

module.exports = router;
