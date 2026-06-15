// config/db.js
// PostgreSQL connection pool using the 'pg' library.
// We use a pool (not a single client) so multiple requests can share connections efficiently.

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 5432,
  database: process.env.DB_NAME     || 'job_board',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  // Keep up to 20 connections open; idle ones close after 30s
  max:              20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Log connection errors so they don't crash the process silently
pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Helper: run a parameterised query and return all rows
const query = (text, params) => pool.query(text, params);

// Helper: get a single client from the pool (for transactions)
const getClient = () => pool.connect();

// Test the connection on startup
const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW() AS current_time');
    console.log(`✅ PostgreSQL connected at ${res.rows[0].current_time}`);
  } catch (err) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    console.error('   Make sure PostgreSQL is running and .env credentials are correct.');
    process.exit(1);
  }
};

module.exports = { query, getClient, testConnection, pool };
