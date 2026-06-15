// controllers/jobController.js
// CRUD for job postings + filtering/search/pagination.

const Job = require('../models/Job');
const Application = require('../models/Application');
const SavedJob = require('../models/SavedJob');

// GET /api/jobs — public, with filtering + pagination
const getJobs = async (req, res, next) => {
  try {
    const { location, company, job_type, minSalary, maxSalary, search, experience_level, page, limit } = req.query;
    const result = await Job.findAll({ location, company, job_type, minSalary, maxSalary, search, experience_level, page, limit });
    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
};

// GET /api/jobs/:id — public
const getJob = async (req, res, next) => {
  try {
    const job = await Job.findById(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });

    // If user is logged in, enrich response with personal context
    let hasApplied = false, isSaved = false;
    if (req.user) {
      hasApplied = !!(await Application.findByUserAndJob(req.user.id, job.id));
      isSaved    = await SavedJob.isSaved(req.user.id, job.id);
    }

    res.json({ success: true, job, hasApplied, isSaved });
  } catch (err) {
    next(err);
  }
};

// POST /api/jobs — employer only
const createJob = async (req, res, next) => {
  try {
    const { title, company, location, salary, job_type, description, requirements, benefits, experience_level } = req.body;
    const job = await Job.create({ title, company, location, salary, job_type, description, requirements, benefits, experience_level, posted_by: req.user.id });
    res.status(201).json({ success: true, message: 'Job posted successfully!', job });
  } catch (err) {
    next(err);
  }
};

// PUT /api/jobs/:id — employer only (must own the job)
const updateJob = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.id);
    const owned = await Job.isOwnedBy(jobId, req.user.id);
    if (!owned) return res.status(403).json({ success: false, message: 'You can only edit your own job postings.' });

    const updated = await Job.update(jobId, req.body);
    if (!updated) return res.status(404).json({ success: false, message: 'Job not found.' });

    res.json({ success: true, message: 'Job updated.', job: updated });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/jobs/:id — employer only (must own the job)
const deleteJob = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.id);
    const owned = await Job.isOwnedBy(jobId, req.user.id);
    if (!owned) return res.status(403).json({ success: false, message: 'You can only delete your own job postings.' });

    const deleted = await Job.delete(jobId);
    if (!deleted) return res.status(404).json({ success: false, message: 'Job not found.' });

    res.json({ success: true, message: 'Job deleted.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/jobs/employer/my-jobs — employer dashboard
const getMyJobs = async (req, res, next) => {
  try {
    const jobs = await Job.findByEmployer(req.user.id);
    res.json({ success: true, jobs });
  } catch (err) {
    next(err);
  }
};

// GET /api/jobs/:id/applicants — employer views who applied
const getApplicants = async (req, res, next) => {
  try {
    const jobId = parseInt(req.params.id);
    const owned = await Job.isOwnedBy(jobId, req.user.id);
    if (!owned) return res.status(403).json({ success: false, message: 'You can only view applicants for your own jobs.' });

    const applicants = await Application.findByJob(jobId);
    res.json({ success: true, applicants });
  } catch (err) {
    next(err);
  }
};

// PATCH /api/jobs/:id/applicants/:appId — employer updates application status
const updateApplicationStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'reviewed', 'shortlisted', 'rejected', 'hired'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: 'Invalid status.' });
    }

    const jobId = parseInt(req.params.id);
    const owned = await Job.isOwnedBy(jobId, req.user.id);
    if (!owned) return res.status(403).json({ success: false, message: 'Access denied.' });

    const updated = await Application.updateStatus(req.params.appId, status);
    if (!updated) return res.status(404).json({ success: false, message: 'Application not found.' });

    res.json({ success: true, message: `Application marked as ${status}.`, application: updated });
  } catch (err) {
    next(err);
  }
};

module.exports = { getJobs, getJob, createJob, updateJob, deleteJob, getMyJobs, getApplicants, updateApplicationStatus };
