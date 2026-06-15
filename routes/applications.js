// routes/applications.js
const express = require('express');
const router = express.Router();

const { getMyApplications, withdrawApplication } = require('../controllers/applicationController');
const { protect, requireRole } = require('../middleware/auth');

router.get( '/',    protect, requireRole('job_seeker'), getMyApplications);
router.delete('/:id', protect, requireRole('job_seeker'), withdrawApplication);

module.exports = router;
