-- ============================================================
-- Job Board Database Schema
-- Run this file to set up the PostgreSQL database
-- ============================================================

-- Create database (run this separately as superuser if needed)
-- CREATE DATABASE job_board;

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- DROP TABLES (for clean re-runs during development)
-- ============================================================
DROP TABLE IF EXISTS saved_jobs CASCADE;
DROP TABLE IF EXISTS applications CASCADE;
DROP TABLE IF EXISTS jobs CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ============================================================
-- USERS TABLE
-- Stores both employers and job seekers
-- ============================================================
CREATE TABLE users (
    id          SERIAL PRIMARY KEY,
    name        VARCHAR(100) NOT NULL,
    email       VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role        VARCHAR(20) NOT NULL CHECK (role IN ('employer', 'job_seeker')),
    avatar_url  TEXT,
    bio         TEXT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast email lookup during login
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role  ON users(role);

-- ============================================================
-- JOBS TABLE
-- Job postings created by employers
-- ============================================================
CREATE TABLE jobs (
    id          SERIAL PRIMARY KEY,
    title       VARCHAR(200) NOT NULL,
    company     VARCHAR(200) NOT NULL,
    location    VARCHAR(200) NOT NULL,
    salary      NUMERIC(12, 2),
    job_type    VARCHAR(50) NOT NULL CHECK (job_type IN ('Full-Time', 'Part-Time', 'Contract', 'Internship', 'Remote', 'Freelance')),
    description TEXT NOT NULL,
    requirements TEXT,
    benefits    TEXT,
    experience_level VARCHAR(50) CHECK (experience_level IN ('Entry Level', 'Mid Level', 'Senior Level', 'Lead', 'Manager', 'Director')),
    posted_by   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    is_active   BOOLEAN DEFAULT TRUE,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common filter/search queries
CREATE INDEX idx_jobs_posted_by    ON jobs(posted_by);
CREATE INDEX idx_jobs_location     ON jobs(location);
CREATE INDEX idx_jobs_job_type     ON jobs(job_type);
CREATE INDEX idx_jobs_company      ON jobs(company);
CREATE INDEX idx_jobs_salary       ON jobs(salary);
CREATE INDEX idx_jobs_is_active    ON jobs(is_active);
CREATE INDEX idx_jobs_created_at   ON jobs(created_at DESC);

-- Full-text search index on title + description
CREATE INDEX idx_jobs_fulltext ON jobs USING GIN (
    to_tsvector('english', title || ' ' || description || ' ' || company)
);

-- ============================================================
-- APPLICATIONS TABLE
-- Tracks job applications by job seekers
-- ============================================================
CREATE TABLE applications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    cover_letter TEXT,
    status      VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'rejected', 'hired')),
    applied_at  TIMESTAMPTZ DEFAULT NOW(),
    updated_at  TIMESTAMPTZ DEFAULT NOW(),
    -- Prevent duplicate applications
    UNIQUE(user_id, job_id)
);

CREATE INDEX idx_applications_user_id ON applications(user_id);
CREATE INDEX idx_applications_job_id  ON applications(job_id);
CREATE INDEX idx_applications_status  ON applications(status);

-- ============================================================
-- SAVED JOBS TABLE
-- Bookmarked jobs for job seekers
-- ============================================================
CREATE TABLE saved_jobs (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    saved_at    TIMESTAMPTZ DEFAULT NOW(),
    -- Prevent duplicate saves
    UNIQUE(user_id, job_id)
);

CREATE INDEX idx_saved_jobs_user_id ON saved_jobs(user_id);
CREATE INDEX idx_saved_jobs_job_id  ON saved_jobs(job_id);

-- ============================================================
-- FUNCTION: auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_applications_updated_at
    BEFORE UPDATE ON applications
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- SEED DATA — Sample users, jobs, applications
-- ============================================================

-- Passwords are bcrypt hashes of 'Password123!'
INSERT INTO users (name, email, password_hash, role, bio) VALUES
('Alice Johnson',    'alice@techcorp.com',   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfD8FOmhEJsAcbC', 'employer',   'Head of Talent at TechCorp. We build the future.'),
('Bob Smith',        'bob@startupxyz.com',   '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfD8FOmhEJsAcbC', 'employer',   'Founder & CEO at StartupXYZ. Hiring rockstars.'),
('Carol White',      'carol@globaltech.com', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfD8FOmhEJsAcbC', 'employer',   'HR Director at GlobalTech.'),
('David Park',       'david@email.com',      '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfD8FOmhEJsAcbC', 'job_seeker', 'Full-stack developer with 3 years experience. Love Python and React.'),
('Emma Davis',       'emma@email.com',       '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfD8FOmhEJsAcbC', 'job_seeker', 'Recent CS graduate eager to land my first dev role.'),
('Frank Miller',     'frank@email.com',      '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewfD8FOmhEJsAcbC', 'job_seeker', 'UI/UX designer with 5 years in product design.');

-- Jobs posted by employers
INSERT INTO jobs (title, company, location, salary, job_type, description, requirements, benefits, experience_level, posted_by) VALUES
(
    'Senior Backend Engineer',
    'TechCorp',
    'Bangalore',
    2200000,
    'Full-Time',
    'We are looking for a Senior Backend Engineer to join our core platform team. You will design, build, and maintain scalable APIs and microservices that power millions of users worldwide.',
    '5+ years of backend development experience. Proficiency in Node.js or Python. Experience with PostgreSQL and Redis. Knowledge of microservices and Docker.',
    'Health insurance, Stock options, Flexible hours, Remote work 3 days/week, Learning budget ₹50,000/year',
    'Senior Level',
    1
),
(
    'Frontend React Developer',
    'StartupXYZ',
    'Mumbai',
    1500000,
    'Full-Time',
    'Join our fast-moving startup as a Frontend Developer. You will build pixel-perfect UIs, collaborate with designers, and ship features every week in our agile environment.',
    '3+ years React experience. Strong TypeScript skills. Experience with state management (Redux/Zustand). CSS mastery and attention to detail.',
    'ESOPs, Startup culture, MacBook Pro, Free meals, Annual retreats',
    'Mid Level',
    2
),
(
    'Python Data Engineer',
    'GlobalTech',
    'Hyderabad',
    1800000,
    'Full-Time',
    'Build the data pipelines that drive our AI products. Work with petabytes of data using PySpark, Airflow, and BigQuery. Partner with data scientists to productionize ML models.',
    '4+ years data engineering experience. Python expertise. Experience with Spark, Airflow, or similar. SQL mastery. Knowledge of cloud platforms (GCP/AWS).',
    'Top-tier health plan, 401k match, Unlimited PTO, Home office stipend',
    'Senior Level',
    3
),
(
    'DevOps / Platform Engineer',
    'TechCorp',
    'Remote',
    1900000,
    'Remote',
    'Own our Kubernetes infrastructure and CI/CD pipelines. Work closely with engineering teams to improve developer experience, reliability, and security of our cloud platform.',
    'Strong Kubernetes and Docker skills. Experience with Terraform. Proficiency in AWS or GCP. CI/CD experience (GitHub Actions, ArgoCD).',
    'Fully remote, Health insurance, Equipment budget, Quarterly team meetups',
    'Senior Level',
    1
),
(
    'UI/UX Design Intern',
    'StartupXYZ',
    'Mumbai',
    400000,
    'Internship',
    'Six-month paid internship for budding designers. Work directly with our Product Lead to redesign our mobile app. You will run user interviews, create wireframes, and build Figma prototypes.',
    'Figma proficiency. Basic understanding of UX principles. Portfolio of 2–3 projects. Pursuing or recently completed design degree.',
    'Stipend ₹33,000/month, Mentorship, Pre-placement offer possibility, Flexible hours',
    'Entry Level',
    2
),
(
    'Full Stack Developer',
    'GlobalTech',
    'Pune',
    1200000,
    'Full-Time',
    'Build and maintain our SaaS platform used by 10,000+ businesses. Work across the stack from React frontends to Node.js APIs and PostgreSQL databases.',
    '2+ years full-stack experience. React and Node.js required. PostgreSQL or MySQL experience. Good understanding of REST APIs.',
    'Health insurance, PF/Gratuity, Annual bonus, WFH 2 days/week',
    'Mid Level',
    3
),
(
    'Machine Learning Engineer',
    'TechCorp',
    'Bangalore',
    2800000,
    'Full-Time',
    'Research and productionize ML models for our recommendation and search systems. Work with large-scale datasets, experiment rapidly, and deploy models to production serving millions of requests per second.',
    'MS/PhD in ML or equivalent industry experience. Strong Python and PyTorch/TensorFlow skills. Experience deploying models in production. Statistics and linear algebra fundamentals.',
    'Top compensation, Research budget, Conference attendance, Stock options',
    'Lead',
    1
),
(
    'Technical Content Writer',
    'StartupXYZ',
    'Remote',
    900000,
    'Contract',
    'Create technical tutorials, blog posts, and documentation for our developer audience. You will interview engineers, understand complex topics, and explain them clearly for developers of all levels.',
    '2+ years technical writing or developer advocacy. Experience with APIs and developer tools. Strong English writing skills. Bonus: coding background.',
    'Remote, Flexible hours, Per-article or monthly retainer options',
    'Mid Level',
    2
),
(
    'Android Developer',
    'GlobalTech',
    'Hyderabad',
    1600000,
    'Full-Time',
    'Build our Android app used by 5M+ users in India. Own features end-to-end, from architecture decisions to Play Store releases. Work in a small, high-ownership mobile team.',
    '3+ years Android development. Kotlin required. MVVM architecture experience. Understanding of Jetpack components. Play Store release experience.',
    'Health + dental, WFH hybrid, Yearly performance bonus, Learning allowance',
    'Mid Level',
    3
),
(
    'Cloud Solutions Architect',
    'TechCorp',
    'Delhi',
    3500000,
    'Full-Time',
    'Design cloud-native architectures for enterprise clients moving to AWS. Lead technical discovery sessions, produce architecture blueprints, and guide implementation teams.',
    '8+ years experience, 5+ in cloud. AWS Solutions Architect certification preferred. Track record with enterprise migrations. Strong communication skills.',
    'Premium compensation, Business travel, Certification sponsorship, Leadership opportunities',
    'Director',
    1
),
(
    'QA Automation Engineer',
    'StartupXYZ',
    'Mumbai',
    1100000,
    'Full-Time',
    'Build and maintain our test automation frameworks. Write end-to-end tests with Playwright, API tests, and integrate testing into our CI/CD pipeline.',
    '3+ years QA automation. Experience with Playwright or Selenium. API testing (Postman/REST Assured). CI/CD integration knowledge.',
    'ESOPs, Flexible WFH, Learning budget, Team socials',
    'Mid Level',
    2
),
(
    'Data Analyst',
    'GlobalTech',
    'Bangalore',
    1000000,
    'Full-Time',
    'Turn raw data into business insights. Build dashboards, run SQL analyses, and partner with product and marketing teams to drive data-informed decisions.',
    '2+ years as a data analyst. Advanced SQL required. Excel/Sheets mastery. Experience with Tableau, Looker, or similar BI tools. Basic Python a plus.',
    'Health insurance, Annual bonus, Hybrid work, Professional development budget',
    'Entry Level',
    3
);

-- Sample applications
INSERT INTO applications (user_id, job_id, cover_letter, status) VALUES
(4, 1, 'I have 4 years of Node.js experience and would love to join TechCorp. My recent project handled 500K req/day.', 'reviewed'),
(4, 2, 'React has been my primary stack for 3 years. I have shipped 10+ production apps and am excited about your mission.', 'pending'),
(5, 5, 'As a recent graduate with a strong design portfolio, I am eager to learn from your team and contribute fresh perspectives.', 'shortlisted'),
(5, 6, 'I have built full-stack apps during my bootcamp and internship. Looking for my first full-time role to grow quickly.', 'pending'),
(6, 5, 'I have 5 years of UI/UX experience and am looking to transition to a product design role at a startup.', 'pending');

-- Saved jobs
INSERT INTO saved_jobs (user_id, job_id) VALUES
(4, 3),
(4, 7),
(5, 1),
(5, 7),
(6, 5),
(6, 8);

-- ============================================================
-- USEFUL VIEWS for debugging
-- ============================================================
CREATE OR REPLACE VIEW v_jobs_with_stats AS
SELECT
    j.*,
    u.name          AS employer_name,
    u.email         AS employer_email,
    COUNT(DISTINCT a.id) AS application_count,
    COUNT(DISTINCT s.id) AS save_count
FROM jobs j
JOIN users u ON j.posted_by = u.id
LEFT JOIN applications a ON j.id = a.job_id
LEFT JOIN saved_jobs s ON j.id = s.job_id
GROUP BY j.id, u.name, u.email;

SELECT 'Schema and seed data loaded successfully!' AS status;
