// models/Job.js
// All SQL queries for the jobs table. Demonstrates JOINs, filtering, full-text search, and pagination.

const db = require('../config/db');

const Job = {
  // ── CREATE ────────────────────────────────────────────────────────────────

  async create({ title, company, location, salary, job_type, description, requirements, benefits, experience_level, posted_by }) {
    const { rows } = await db.query(
      `INSERT INTO jobs
         (title, company, location, salary, job_type, description, requirements, benefits, experience_level, posted_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [title, company, location, salary || null, job_type, description, requirements || null, benefits || null, experience_level || null, posted_by]
    );
    return rows[0];
  },

  // ── READ (with advanced filtering + pagination) ──────────────────────────

  async findAll({ location, company, job_type, minSalary, maxSalary, search, experience_level, page = 1, limit = 10 } = {}) {
    // Build WHERE clauses dynamically — parameterised to prevent SQL injection
    const conditions = ['j.is_active = TRUE'];
    const params = [];
    let idx = 1;

    if (location) {
      conditions.push(`LOWER(j.location) LIKE $${idx++}`);
      params.push(`%${location.toLowerCase()}%`);
    }
    if (company) {
      conditions.push(`LOWER(j.company) LIKE $${idx++}`);
      params.push(`%${company.toLowerCase()}%`);
    }
    if (job_type) {
      conditions.push(`j.job_type = $${idx++}`);
      params.push(job_type);
    }
    if (minSalary) {
      conditions.push(`j.salary >= $${idx++}`);
      params.push(Number(minSalary));
    }
    if (maxSalary) {
      conditions.push(`j.salary <= $${idx++}`);
      params.push(Number(maxSalary));
    }
    if (experience_level) {
      conditions.push(`j.experience_level = $${idx++}`);
      params.push(experience_level);
    }
    // Full-text search across title, company, and description
    if (search) {
      conditions.push(
        `to_tsvector('english', j.title || ' ' || j.description || ' ' || j.company) @@ plainto_tsquery('english', $${idx++})`
      );
      params.push(search);
    }

    const where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

    // Count total results (for pagination metadata)
    const countResult = await db.query(
      `SELECT COUNT(*) FROM jobs j ${where}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Pagination
    const safePage  = Math.max(1, parseInt(page)  || 1);
    const safeLimit = Math.min(50, Math.max(1, parseInt(limit) || 10));
    const offset = (safePage - 1) * safeLimit;

    params.push(safeLimit, offset);

    // Main query with JOIN to get employer name + application counts
    const { rows } = await db.query(
      `SELECT
         j.id, j.title, j.company, j.location, j.salary, j.job_type,
         j.description, j.requirements, j.benefits, j.experience_level,
         j.is_active, j.created_at, j.updated_at,
         u.id   AS employer_id,
         u.name AS employer_name,
         COUNT(DISTINCT a.id) AS application_count
       FROM jobs j
       JOIN users u ON j.posted_by = u.id
       LEFT JOIN applications a ON j.id = a.job_id
       ${where}
       GROUP BY j.id, u.id, u.name
       ORDER BY j.created_at DESC
       LIMIT $${idx++} OFFSET $${idx++}`,
      params
    );

    return {
      jobs: rows,
      pagination: {
        total,
        page:        safePage,
        limit:       safeLimit,
        total_pages: Math.ceil(total / safeLimit),
        has_next:    safePage < Math.ceil(total / safeLimit),
        has_prev:    safePage > 1,
      },
    };
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT
         j.*,
         u.id   AS employer_id,
         u.name AS employer_name,
         u.email AS employer_email,
         u.bio  AS employer_bio,
         COUNT(DISTINCT a.id) AS application_count
       FROM jobs j
       JOIN users u ON j.posted_by = u.id
       LEFT JOIN applications a ON j.id = a.job_id
       WHERE j.id = $1
       GROUP BY j.id, u.id, u.name, u.email, u.bio`,
      [id]
    );
    return rows[0] || null;
  },

  async findByEmployer(posted_by) {
    const { rows } = await db.query(
      `SELECT
         j.*,
         COUNT(DISTINCT a.id) AS application_count
       FROM jobs j
       LEFT JOIN applications a ON j.id = a.job_id
       WHERE j.posted_by = $1
       GROUP BY j.id
       ORDER BY j.created_at DESC`,
      [posted_by]
    );
    return rows;
  },

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(id, { title, company, location, salary, job_type, description, requirements, benefits, experience_level, is_active }) {
    const { rows } = await db.query(
      `UPDATE jobs SET
         title            = COALESCE($1,  title),
         company          = COALESCE($2,  company),
         location         = COALESCE($3,  location),
         salary           = COALESCE($4,  salary),
         job_type         = COALESCE($5,  job_type),
         description      = COALESCE($6,  description),
         requirements     = COALESCE($7,  requirements),
         benefits         = COALESCE($8,  benefits),
         experience_level = COALESCE($9,  experience_level),
         is_active        = COALESCE($10, is_active)
       WHERE id = $11
       RETURNING *`,
      [title, company, location, salary, job_type, description, requirements, benefits, experience_level, is_active, id]
    );
    return rows[0] || null;
  },

  // ── DELETE ────────────────────────────────────────────────────────────────

  async delete(id) {
    const { rows } = await db.query(
      `DELETE FROM jobs WHERE id = $1 RETURNING id`,
      [id]
    );
    return rows[0] || null;
  },

  // Verify a job belongs to a given employer (for authorization)
  async isOwnedBy(jobId, userId) {
    const { rows } = await db.query(
      `SELECT id FROM jobs WHERE id = $1 AND posted_by = $2`,
      [jobId, userId]
    );
    return rows.length > 0;
  },
};

module.exports = Job;
