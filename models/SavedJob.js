// models/SavedJob.js
// SQL queries for the saved_jobs (bookmarks) table.

const db = require('../config/db');

const SavedJob = {
  async save(user_id, job_id) {
    const { rows } = await db.query(
      `INSERT INTO saved_jobs (user_id, job_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, job_id) DO NOTHING
       RETURNING *`,
      [user_id, job_id]
    );
    return rows[0] || null; // null means it was already saved
  },

  async unsave(user_id, job_id) {
    const { rows } = await db.query(
      `DELETE FROM saved_jobs WHERE user_id = $1 AND job_id = $2 RETURNING id`,
      [user_id, job_id]
    );
    return rows[0] || null;
  },

  async findByUser(user_id) {
    const { rows } = await db.query(
      `SELECT
         s.id AS saved_id, s.saved_at,
         j.id, j.title, j.company, j.location, j.salary, j.job_type,
         j.description, j.experience_level, j.is_active, j.created_at,
         COUNT(DISTINCT a.id) AS application_count
       FROM saved_jobs s
       JOIN jobs j ON s.job_id = j.id
       LEFT JOIN applications a ON j.id = a.job_id
       WHERE s.user_id = $1
       GROUP BY s.id, s.saved_at, j.id
       ORDER BY s.saved_at DESC`,
      [user_id]
    );
    return rows;
  },

  async isSaved(user_id, job_id) {
    const { rows } = await db.query(
      `SELECT id FROM saved_jobs WHERE user_id = $1 AND job_id = $2`,
      [user_id, job_id]
    );
    return rows.length > 0;
  },

  // Return a Set of job IDs saved by this user — efficient for bulk checks
  async getSavedJobIds(user_id) {
    const { rows } = await db.query(
      `SELECT job_id FROM saved_jobs WHERE user_id = $1`,
      [user_id]
    );
    return new Set(rows.map(r => r.job_id));
  },
};

module.exports = SavedJob;
