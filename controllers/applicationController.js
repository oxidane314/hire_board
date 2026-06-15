// controllers/applicationController.js
// Job seekers apply for jobs, view their applications, and withdraw.

const Application = require('../models/Application');
const Job = require('../models/Job');

// POST /api/jobs/:id/apply — job seeker only
const applyForJob = async (req, res, next) => {
  try {
    const job_id = parseInt(req.params.id);
    const user_id = req.user.id;
    const { cover_letter } = req.body;

    // Check job exists and is active
    const job = await Job.findById(job_id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });
    if (!job.is_active) return res.status(400).json({ success: false, message: 'This job is no longer accepting applications.' });

    // Employers cannot apply to jobs
    if (req.user.role === 'employer') {
      return res.status(403).json({ success: false, message: 'Employers cannot apply for jobs.' });
    }

    // Check for duplicate application
    const already = await Application.findByUserAndJob(user_id, job_id);
    if (already) return res.status(409).json({ success: false, message: 'You have already applied for this job.' });

    const application = await Application.create({ user_id, job_id, cover_letter });

    res.status(201).json({ success: true, message: 'Application submitted!', application });
  } catch (err) {
    next(err);
  }
};

// GET /api/applications — job seeker views their own applications
const getMyApplications = async (req, res, next) => {
  try {
    const applications = await Application.findByUser(req.user.id);
    res.json({ success: true, applications });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/applications/:id — job seeker withdraws an application
const withdrawApplication = async (req, res, next) => {
  try {
    // Only allow withdrawal of own applications
    const apps = await Application.findByUser(req.user.id);
    const app = apps.find(a => a.id === parseInt(req.params.id));
    if (!app) return res.status(404).json({ success: false, message: 'Application not found.' });

    await Application.delete(req.params.id);
    res.json({ success: true, message: 'Application withdrawn.' });
  } catch (err) {
    next(err);
  }
};

module.exports = { applyForJob, getMyApplications, withdrawApplication };
