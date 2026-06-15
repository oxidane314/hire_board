// controllers/savedJobController.js
// Job seekers bookmark/unsave jobs.

const SavedJob = require('../models/SavedJob');
const Job = require('../models/Job');

// POST /api/jobs/:id/save
const saveJob = async (req, res, next) => {
  try {
    const job_id = parseInt(req.params.id);
    const user_id = req.user.id;

    const job = await Job.findById(job_id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found.' });

    const saved = await SavedJob.save(user_id, job_id);
    if (!saved) return res.status(409).json({ success: false, message: 'Job already saved.' });

    res.status(201).json({ success: true, message: 'Job saved to your list.' });
  } catch (err) {
    next(err);
  }
};

// DELETE /api/jobs/:id/save
const unsaveJob = async (req, res, next) => {
  try {
    const removed = await SavedJob.unsave(req.user.id, parseInt(req.params.id));
    if (!removed) return res.status(404).json({ success: false, message: 'Saved job not found.' });
    res.json({ success: true, message: 'Job removed from saved list.' });
  } catch (err) {
    next(err);
  }
};

// GET /api/saved-jobs
const getSavedJobs = async (req, res, next) => {
  try {
    const jobs = await SavedJob.findByUser(req.user.id);
    res.json({ success: true, jobs });
  } catch (err) {
    next(err);
  }
};

module.exports = { saveJob, unsaveJob, getSavedJobs };
