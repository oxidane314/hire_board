// models/User.js
// All SQL queries related to the users table live here (Model layer in MVC).

const db = require('../config/db');
const bcrypt = require('bcryptjs');

const User = {
  // ── CREATE ────────────────────────────────────────────────────────────────

  async create({ name, email, password, role }) {
    // Hash the password with cost factor 12 (strong but not too slow)
    const password_hash = await bcrypt.hash(password, 12);

    const { rows } = await db.query(
      `INSERT INTO users (name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, name, email, role, created_at`,
      [name, email, password_hash, role]
    );
    return rows[0];
  },

  // ── READ ──────────────────────────────────────────────────────────────────

  async findByEmail(email) {
    const { rows } = await db.query(
      `SELECT * FROM users WHERE email = $1`,
      [email]
    );
    return rows[0] || null;
  },

  async findById(id) {
    const { rows } = await db.query(
      `SELECT id, name, email, role, bio, avatar_url, created_at
       FROM users WHERE id = $1`,
      [id]
    );
    return rows[0] || null;
  },

  // ── UPDATE ────────────────────────────────────────────────────────────────

  async update(id, { name, bio }) {
    const { rows } = await db.query(
      `UPDATE users
       SET name = COALESCE($1, name),
           bio  = COALESCE($2, bio)
       WHERE id = $3
       RETURNING id, name, email, role, bio, created_at`,
      [name, bio, id]
    );
    return rows[0];
  },

  // ── AUTH ──────────────────────────────────────────────────────────────────

  // Compare a plaintext password against the stored hash
  async verifyPassword(plaintext, hash) {
    return bcrypt.compare(plaintext, hash);
  },
};

module.exports = User;
