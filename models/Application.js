// models/Application.js
// SQL queries for the applications table — demonstrates foreign key JOINs across 3 tables.

const db = require('../config/db');

const Application = {
  // ── CREATE ────────────────────────────────────────────────────────────────

  async create({ user_id, job_id, cover_letter }) {
    const { rows } = await db.query(
      `INSERT INTO applications (user_id, job_id, cover_letter)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [user_id, job_id, cover_letter || null]
    );
    return rows[0];
  },

  // ── READ ──────────────────────────────────────────────────────────────────

  // All applications submitted by a job seeker — joined with job details
  async findByUser(user_id) {
    const { rows } = await db.query(
      `SELECT
         a.id, a.cover_letter, a.status, a.applied_at, a.updated_at,
         j.id          AS job_id,
         j.title       AS job_title,
         j.company,
         j.location,
         j.salary,
         j.job_type,
         j.is_active   AS job_active
       FROM applications a
       JOIN jobs j ON a.job_id = j.id
       WHERE a.user_id = $1
       ORDER BY a.applied_at DESC`,
      [user_id]
    );
    return rows;
  },

  // All applications for a specific job — joined with applicant details
  async findByJob(job_id) {
    const { rows } = await db.query(
      `SELECT
         a.id, a.cover_letter, a.status, a.applied_at, a.updated_at,
         u.id    AS applicant_id,
         u.name  AS applicant_name,
         u.email AS applicant_email,
         u.bio   AS applicant_bio
       FROM applications a
       JOIN users u ON a.user_id = u.id
       WHERE a.job_id = $1
       ORDER BY a.applied_at ASC`,
      [job_id]
    );
    return rows;
  },

  // Check if a user has already applied for a job
  async findByUserAndJob(user_id, job_id) {
    const { rows } = await db.query(
      `SELECT * FROM applications WHERE user_id = $1 AND job_id = $2`,
      [user_id, job_id]
    );
    return rows[0] || null;
  },

  // ── UPDATE (employer updates application status) ───────────────────────

  async updateStatus(id, status) {
    const { rows } = await db.query(
      `UPDATE applications SET status = $1 WHERE id = $2 RETURNING *`,
      [status, id]
    );
    return rows[0] || null;
  },

  // ── DELETE ────────────────────────────────────────────────────────────────

  async delete(id) {
    const { rows } = await db.query(
      `DELETE FROM applications WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },
};

module.exports = Application;
