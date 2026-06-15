// routes/jobs.js
const express = require('express');
const router = express.Router();

const { getJobs, getJob, createJob, updateJob, deleteJob, getMyJobs, getApplicants, updateApplicationStatus } = require('../controllers/jobController');
const { applyForJob } = require('../controllers/applicationController');
const { saveJob, unsaveJob } = require('../controllers/savedJobController');
const { protect, requireRole, optionalAuth } = require('../middleware/auth');
const { validateJob, validateApplication } = require('../middleware/validate');

// Public routes (optional auth for personalisation)
router.get('/',     optionalAuth, getJobs);
router.get('/:id',  optionalAuth, getJob);

// Employer-only: manage own jobs
router.post('/',    protect, requireRole('employer'), validateJob, createJob);
router.put('/:id',  protect, requireRole('employer'), updateJob);
router.delete('/:id', protect, requireRole('employer'), deleteJob);

// Employer dashboard: view own posted jobs
router.get('/employer/my-jobs', protect, requireRole('employer'), getMyJobs);

// Employer: view & manage applicants
router.get( '/:id/applicants',           protect, requireRole('employer'), getApplicants);
router.patch('/:id/applicants/:appId',   protect, requireRole('employer'), updateApplicationStatus);

// Job seeker: apply & save
router.post('/:id/apply', protect, requireRole('job_seeker'), validateApplication, applyForJob);
router.post('/:id/save',  protect, requireRole('job_seeker'), saveJob);
router.delete('/:id/save', protect, requireRole('job_seeker'), unsaveJob);

module.exports = router;
