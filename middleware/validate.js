// middleware/validate.js
// Input validation rules using express-validator.
// Keeps controller code clean — validation is a cross-cutting concern.

const { body, validationResult } = require('express-validator');

// ── Reusable middleware: collect errors and return 422 if any ────────────────
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(422).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
  }
  next();
};

// ── Auth validators ──────────────────────────────────────────────────────────
const validateRegister = [
  body('name')
    .trim()
    .notEmpty().withMessage('Name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Name must be 2–100 characters'),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required')
    .isEmail().withMessage('Must be a valid email address')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
    .matches(/[0-9]/).withMessage('Password must contain at least one number'),

  body('role')
    .notEmpty().withMessage('Role is required')
    .isIn(['employer', 'job_seeker']).withMessage('Role must be "employer" or "job_seeker"'),

  handleValidationErrors,
];

const validateLogin = [
  body('email').trim().notEmpty().withMessage('Email is required').isEmail().normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors,
];

// ── Job validators ───────────────────────────────────────────────────────────
const validateJob = [
  body('title')
    .trim().notEmpty().withMessage('Job title is required')
    .isLength({ max: 200 }).withMessage('Title must be ≤ 200 characters'),

  body('company')
    .trim().notEmpty().withMessage('Company name is required')
    .isLength({ max: 200 }).withMessage('Company must be ≤ 200 characters'),

  body('location')
    .trim().notEmpty().withMessage('Location is required'),

  body('job_type')
    .notEmpty().withMessage('Job type is required')
    .isIn(['Full-Time', 'Part-Time', 'Contract', 'Internship', 'Remote', 'Freelance'])
    .withMessage('Invalid job type'),

  body('description')
    .trim().notEmpty().withMessage('Description is required')
    .isLength({ min: 50 }).withMessage('Description must be at least 50 characters'),

  body('salary')
    .optional({ nullable: true, checkFalsy: true })
    .isNumeric().withMessage('Salary must be a number')
    .isFloat({ min: 0 }).withMessage('Salary cannot be negative'),

  body('experience_level')
    .optional({ nullable: true, checkFalsy: true })
    .isIn(['Entry Level', 'Mid Level', 'Senior Level', 'Lead', 'Manager', 'Director'])
    .withMessage('Invalid experience level'),

  handleValidationErrors,
];

// ── Application validator ────────────────────────────────────────────────────
const validateApplication = [
  body('cover_letter')
    .optional({ nullable: true, checkFalsy: true })
    .isLength({ max: 5000 }).withMessage('Cover letter must be ≤ 5000 characters'),
  handleValidationErrors,
];

module.exports = { validateRegister, validateLogin, validateJob, validateApplication };
