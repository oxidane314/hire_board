// public/js/app.js
// Single-Page Application logic — routing, API calls, rendering.
// No frameworks, pure vanilla JS to demonstrate fundamentals clearly.

'use strict';

// ── STATE ─────────────────────────────────────────────────────────────────────
const state = {
  user:          null,  // logged-in user object (or null)
  token:         null,  // JWT token string
  currentPage:   'home',
  currentJobId:  null,
  applyingToJob: null,
  jobsPage:      1,
  jobsFilters:   {},
  dashboardTab:  null,
};

// ── API HELPERS ───────────────────────────────────────────────────────────────

const API = async (method, path, body = null) => {
  const opts = {
    method,
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',  // send HttpOnly cookie automatically
  };
  if (state.token) opts.headers['Authorization'] = `Bearer ${state.token}`;
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`/api${path}`, opts);
  const data = await res.json();
  if (!res.ok) throw Object.assign(new Error(data.message || 'Request failed'), { data, status: res.status });
  return data;
};

const get    = (path)         => API('GET',    path);
const post   = (path, body)   => API('POST',   path, body);
const put    = (path, body)   => API('PUT',    path, body);
const patch  = (path, body)   => API('PATCH',  path, body);
const del    = (path)         => API('DELETE', path);

// ── FLASH MESSAGES ────────────────────────────────────────────────────────────

const flash = (msg, type = 'info', duration = 4000) => {
  const container = document.getElementById('flash-container');
  const el = document.createElement('div');
  el.className = `flash flash-${type}`;
  el.innerHTML = `
    <span>${msg}</span>
    <button class="flash-close" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(el);
  setTimeout(() => el.remove(), duration);
};

// ── ROUTING ───────────────────────────────────────────────────────────────────

const navigate = (page, params = {}) => {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(`page-${page}`);
  if (!target) return;
  target.classList.add('active');
  state.currentPage = page;
  window.scrollTo(0, 0);

  // Update nav active state
  document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));

  // Route-specific initialisation
  switch (page) {
    case 'home':      initHomePage(); break;
    case 'jobs':      initJobsPage(params); break;
    case 'job-detail': initJobDetailPage(params.jobId || state.currentJobId); break;
    case 'dashboard': initDashboard(); break;
    case 'post-job':  initPostJobPage(params); break;
    case 'login':
    case 'register':  if (state.user) navigate('dashboard'); break;
  }
};

// ── AUTH STATE ────────────────────────────────────────────────────────────────

const setUser = (user, token) => {
  state.user  = user;
  state.token = token;
  if (token) localStorage.setItem('jb_token', token);
  if (user)  localStorage.setItem('jb_user',  JSON.stringify(user));
  updateNavUI();
};

const clearUser = () => {
  state.user = null; state.token = null;
  localStorage.removeItem('jb_token');
  localStorage.removeItem('jb_user');
  updateNavUI();
};

const updateNavUI = () => {
  const authBtns    = document.getElementById('nav-auth-btns');
  const userInfo    = document.getElementById('nav-user-info');
  const navDash     = document.getElementById('nav-dashboard');
  const navPostJob  = document.getElementById('nav-post-job');
  const avatar      = document.getElementById('nav-avatar');
  const username    = document.getElementById('nav-username');
  const sidebarCta  = document.getElementById('sidebar-cta');

  if (state.user) {
    authBtns.style.display  = 'none';
    userInfo.style.display  = 'flex';
    navDash.style.display   = 'block';
    if (sidebarCta) sidebarCta.style.display = 'none';
    avatar.textContent  = state.user.name[0].toUpperCase();
    username.textContent = state.user.name.split(' ')[0];

    if (state.user.role === 'employer') {
      navPostJob.style.display = 'block';
    }
  } else {
    authBtns.style.display  = 'flex';
    userInfo.style.display  = 'none';
    navDash.style.display   = 'none';
    navPostJob.style.display = 'none';
    if (sidebarCta) sidebarCta.style.display = 'block';
  }
};

// Restore session from localStorage on page load
const restoreSession = async () => {
  const token = localStorage.getItem('jb_token');
  const user  = localStorage.getItem('jb_user');
  if (token && user) {
    state.token = token;
    state.user  = JSON.parse(user);
    updateNavUI();
    // Silently verify token is still valid
    try {
      const data = await get('/auth/me');
      setUser(data.user, token);
    } catch {
      clearUser();
    }
  }
};

// ── HOME PAGE ─────────────────────────────────────────────────────────────────

const initHomePage = async () => {
  try {
    const data = await get('/jobs?limit=6');
    document.getElementById('stat-jobs').textContent = data.pagination.total + '+';
    renderJobCards(data.jobs, 'home-jobs-list', true);
  } catch {
    document.getElementById('home-jobs-list').innerHTML = '<p style="color:var(--grey-400)">Could not load jobs.</p>';
  }
};

const heroSearch = () => {
  const q = document.getElementById('hero-search').value.trim();
  navigate('jobs', { search: q });
};

// ── JOBS LISTING PAGE ─────────────────────────────────────────────────────────

let filterDebounceTimer;
const debounceFilter = () => {
  clearTimeout(filterDebounceTimer);
  filterDebounceTimer = setTimeout(applyFilters, 380);
};

const initJobsPage = (params = {}) => {
  state.jobsPage = 1;
  // Pre-fill filter if coming from search/hero
  if (params.search) {
    document.getElementById('filter-search').value = params.search;
  }
  if (params.job_type) {
    document.getElementById('filter-type').value = params.job_type;
  }
  applyFilters();
};

const applyFilters = async () => {
  const search    = document.getElementById('filter-search')?.value?.trim();
  const location  = document.getElementById('filter-location')?.value?.trim();
  const company   = document.getElementById('filter-company')?.value?.trim();
  const job_type  = document.getElementById('filter-type')?.value;
  const experience_level = document.getElementById('filter-level')?.value;
  const minSalary = document.getElementById('filter-min-salary')?.value;

  state.jobsFilters = { search, location, company, job_type, experience_level, minSalary };
  await loadJobs();
};

const clearFilters = () => {
  ['filter-search','filter-location','filter-company','filter-min-salary'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('filter-type').value  = '';
  document.getElementById('filter-level').value = '';
  state.jobsPage    = 1;
  state.jobsFilters = {};
  loadJobs();
};

const filterByType = (type) => {
  navigate('jobs', { job_type: type });
};

const loadJobs = async () => {
  const list = document.getElementById('jobs-list');
  list.innerHTML = '<div class="spinner"></div><p class="loading-text">Loading jobs…</p>';

  const params = new URLSearchParams({
    page: state.jobsPage,
    limit: 8,
    ...Object.fromEntries(Object.entries(state.jobsFilters).filter(([,v]) => v)),
  });

  try {
    const data = await get(`/jobs?${params}`);
    const label = document.getElementById('jobs-count-label');
    label.textContent = `${data.pagination.total} job${data.pagination.total !== 1 ? 's' : ''} found`;

    if (!data.jobs.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">🔍</div>
          <h3>No jobs match your filters</h3>
          <p>Try broadening your search or clearing some filters.</p>
          <button class="btn btn-secondary" onclick="clearFilters()">Clear filters</button>
        </div>`;
      document.getElementById('jobs-pagination').innerHTML = '';
      return;
    }

    renderJobCards(data.jobs, 'jobs-list');
    renderPagination(data.pagination);
  } catch (err) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Could not load jobs</h3><p>${err.message}</p></div>`;
  }
};

const renderJobCards = (jobs, containerId, compact = false) => {
  const container = document.getElementById(containerId);
  if (!jobs.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📭</div><h3>No jobs yet</h3></div>';
    return;
  }

  container.innerHTML = jobs.map(job => {
    const isNew = (Date.now() - new Date(job.created_at)) < 3 * 24 * 60 * 60 * 1000;
    return `
    <div class="job-card" onclick="openJobDetail(${job.id})">
      ${isNew ? '<span class="tag tag-new">NEW</span>' : ''}
      <div class="job-card-top">
        <div style="flex:1;min-width:0;">
          <div class="job-card-company">${esc(job.company)}</div>
          <div class="job-card-title">${esc(job.title)}</div>
          <div class="job-card-meta">
            <span class="meta-item">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              ${esc(job.location)}
            </span>
            ${job.experience_level ? `<span class="meta-item">🎯 ${esc(job.experience_level)}</span>` : ''}
            <span class="meta-item">👥 ${job.application_count} applicant${job.application_count != 1 ? 's' : ''}</span>
          </div>
          ${!compact ? `<p class="job-card-desc">${esc(job.description)}</p>` : ''}
        </div>
      </div>
      <div class="job-card-footer">
        <div class="job-card-salary">${job.salary ? '₹' + Number(job.salary).toLocaleString('en-IN') : 'Salary not disclosed'}</div>
        <div class="job-card-tags">
          <span class="tag tag-type">${esc(job.job_type)}</span>
          ${job.experience_level ? `<span class="tag tag-level">${esc(job.experience_level)}</span>` : ''}
        </div>
      </div>
    </div>`;
  }).join('');
};

const renderPagination = (pagination) => {
  const container = document.getElementById('jobs-pagination');
  if (pagination.total_pages <= 1) { container.innerHTML = ''; return; }

  let html = `<button class="page-btn" onclick="goToPage(${pagination.page - 1})" ${!pagination.has_prev ? 'disabled' : ''}>‹</button>`;

  for (let i = 1; i <= pagination.total_pages; i++) {
    if (i === 1 || i === pagination.total_pages || Math.abs(i - pagination.page) <= 2) {
      html += `<button class="page-btn ${i === pagination.page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    } else if (Math.abs(i - pagination.page) === 3) {
      html += `<span class="page-btn" style="border:none;cursor:default;">…</span>`;
    }
  }
  html += `<button class="page-btn" onclick="goToPage(${pagination.page + 1})" ${!pagination.has_next ? 'disabled' : ''}>›</button>`;
  container.innerHTML = html;
};

const goToPage = async (page) => {
  state.jobsPage = page;
  await loadJobs();
  document.getElementById('page-jobs').scrollIntoView({ behavior: 'smooth' });
};

// ── JOB DETAIL PAGE ───────────────────────────────────────────────────────────

const openJobDetail = (jobId) => {
  state.currentJobId = jobId;
  navigate('job-detail', { jobId });
};

const initJobDetailPage = async (jobId) => {
  const mainEl    = document.getElementById('job-detail-main');
  const sidebarEl = document.getElementById('job-detail-sidebar');
  mainEl.innerHTML = '<div class="spinner"></div>';
  sidebarEl.innerHTML = '';

  try {
    const data = await get(`/jobs/${jobId}`);
    const { job, hasApplied, isSaved } = data;

    mainEl.innerHTML = `
      <div class="job-detail-card">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:20px;">
          <div>
            <div class="job-detail-eyebrow">${esc(job.company)}</div>
            <h1 class="job-detail-title">${esc(job.title)}</h1>
          </div>
          <div style="display:flex;gap:8px;flex-shrink:0;flex-wrap:wrap;">
            <span class="tag tag-type">${esc(job.job_type)}</span>
            ${job.experience_level ? `<span class="tag tag-level">${esc(job.experience_level)}</span>` : ''}
          </div>
        </div>

        <div class="job-detail-meta">
          <span class="meta-item">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${esc(job.location)}
          </span>
          ${job.salary ? `<span class="meta-item">💰 ₹${Number(job.salary).toLocaleString('en-IN')} / year</span>` : ''}
          <span class="meta-item">👥 ${job.application_count} applicant${job.application_count != 1 ? 's' : ''}</span>
          <span class="meta-item">📅 Posted ${timeAgo(job.created_at)}</span>
        </div>

        <div class="job-detail-section">
          <h3>About the role</h3>
          <p>${esc(job.description)}</p>
        </div>

        ${job.requirements ? `
        <div class="job-detail-section">
          <h3>Requirements</h3>
          <p>${esc(job.requirements)}</p>
        </div>` : ''}

        ${job.benefits ? `
        <div class="job-detail-section">
          <h3>Benefits & Perks</h3>
          <p>${esc(job.benefits)}</p>
        </div>` : ''}

        <div class="job-detail-section">
          <h3>About ${esc(job.company)}</h3>
          <p style="color:var(--grey-600);">${job.employer_bio ? esc(job.employer_bio) : 'Employer information not provided.'}</p>
        </div>
      </div>
    `;

    // Sidebar with Apply / Save actions
    sidebarEl.innerHTML = `
      <div class="sidebar-card" style="position:sticky;top:80px;">
        <div style="font-size:1.5rem;font-family:var(--font-hd);font-weight:700;color:var(--navy);margin-bottom:4px;">
          ${job.salary ? '₹' + Number(job.salary).toLocaleString('en-IN') : 'Salary TBD'}
        </div>
        ${job.salary ? '<div style="font-size:.78rem;color:var(--grey-400);margin-bottom:16px;">per year</div>' : '<div style="margin-bottom:16px;"></div>'}

        <div id="job-actions">
          ${renderJobActions(job, hasApplied, isSaved)}
        </div>

        <div style="margin-top:20px;padding-top:16px;border-top:1px solid var(--grey-200);">
          <div style="font-size:.8rem;color:var(--grey-400);font-weight:500;margin-bottom:8px;">JOB DETAILS</div>
          <div style="display:flex;flex-direction:column;gap:8px;">
            <div style="display:flex;justify-content:space-between;font-size:.85rem;">
              <span style="color:var(--grey-400);">Type</span>
              <span style="font-weight:600;">${esc(job.job_type)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:.85rem;">
              <span style="color:var(--grey-400);">Location</span>
              <span style="font-weight:600;">${esc(job.location)}</span>
            </div>
            ${job.experience_level ? `
            <div style="display:flex;justify-content:space-between;font-size:.85rem;">
              <span style="color:var(--grey-400);">Level</span>
              <span style="font-weight:600;">${esc(job.experience_level)}</span>
            </div>` : ''}
            <div style="display:flex;justify-content:space-between;font-size:.85rem;">
              <span style="color:var(--grey-400);">Posted by</span>
              <span style="font-weight:600;">${esc(job.employer_name)}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="sidebar-card">
        <button class="btn btn-ghost btn-block" onclick="navigate('jobs')">← Back to listings</button>
      </div>
    `;
  } catch (err) {
    mainEl.innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><h3>Job not found</h3><p>${err.message}</p><button class="btn btn-secondary" onclick="navigate('jobs')">Back to jobs</button></div>`;
  }
};

const renderJobActions = (job, hasApplied, isSaved) => {
  if (!state.user) {
    return `
      <p style="color:var(--grey-400);font-size:.85rem;margin-bottom:12px;">Sign in to apply or save this job.</p>
      <button class="btn btn-primary btn-block" onclick="navigate('login')">Sign in to Apply</button>
      <button class="btn btn-ghost btn-block" style="margin-top:8px;" onclick="navigate('register')">Create account</button>
    `;
  }
  if (state.user.role === 'employer') {
    return `<p style="color:var(--grey-400);font-size:.85rem;text-align:center;">Employers cannot apply for jobs.</p>`;
  }

  let html = '';
  if (hasApplied) {
    html += `<button class="btn btn-success btn-block" disabled>✓ Applied</button>`;
  } else if (!job.is_active) {
    html += `<button class="btn btn-ghost btn-block" disabled>Job Closed</button>`;
  } else {
    html += `<button class="btn btn-primary btn-block" onclick="openApplyModal(${job.id}, '${esc(job.title).replace(/'/g, "\\'")}')">Apply Now</button>`;
  }

  html += `<button class="btn ${isSaved ? 'btn-secondary' : 'btn-ghost'} btn-block" style="margin-top:8px;" 
    onclick="${isSaved ? `unsaveJob(${job.id})` : `saveJob(${job.id})`}" id="save-btn">
    ${isSaved ? '🔖 Saved' : '☆ Save job'}
  </button>`;
  return html;
};

// ── APPLY MODAL ────────────────────────────────────────────────────────────────

const openApplyModal = (jobId, jobTitle) => {
  state.applyingToJob = jobId;
  document.getElementById('apply-job-title').textContent = jobTitle;
  document.getElementById('cover-letter').value = '';
  document.getElementById('apply-modal').classList.remove('hidden');
};

const closeApplyModal = () => {
  document.getElementById('apply-modal').classList.add('hidden');
  state.applyingToJob = null;
};

const submitApplication = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('apply-btn');
  const coverLetter = document.getElementById('cover-letter').value.trim();
  btn.textContent = 'Submitting…'; btn.disabled = true;

  try {
    await post(`/jobs/${state.applyingToJob}/apply`, { cover_letter: coverLetter });
    closeApplyModal();
    flash('Application submitted! 🎉', 'success');
    // Refresh the job detail to show "Applied" state
    initJobDetailPage(state.applyingToJob || state.currentJobId);
  } catch (err) {
    flash(err.message, 'error');
  } finally {
    btn.textContent = 'Submit Application'; btn.disabled = false;
  }
};

// ── SAVE / UNSAVE ─────────────────────────────────────────────────────────────

const saveJob = async (jobId) => {
  try {
    await post(`/jobs/${jobId}/save`);
    flash('Job saved! 🔖', 'success');
    initJobDetailPage(jobId);
  } catch (err) { flash(err.message, 'error'); }
};

const unsaveJob = async (jobId) => {
  try {
    await del(`/jobs/${jobId}/save`);
    flash('Removed from saved jobs.', 'info');
    initJobDetailPage(jobId);
  } catch (err) { flash(err.message, 'error'); }
};

// ── AUTH ───────────────────────────────────────────────────────────────────────

const handleLogin = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('login-btn');
  const errEl = document.getElementById('login-error');
  btn.textContent = 'Signing in…'; btn.disabled = true; errEl.textContent = '';

  try {
    const data = await post('/auth/login', {
      email:    document.getElementById('login-email').value.trim(),
      password: document.getElementById('login-password').value,
    });
    setUser(data.user, data.token);
    flash(`Welcome back, ${data.user.name.split(' ')[0]}! 👋`, 'success');
    navigate('dashboard');
  } catch (err) {
    errEl.textContent = err.message;
    if (err.data?.errors) {
      err.data.errors.forEach(e => {
        const errField = document.getElementById(`login-${e.field}-error`);
        if (errField) errField.textContent = e.message;
      });
    }
  } finally {
    btn.textContent = 'Sign in'; btn.disabled = false;
  }
};

const handleRegister = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('register-btn');
  const errEl = document.getElementById('register-error');
  btn.textContent = 'Creating account…'; btn.disabled = true; errEl.textContent = '';

  // Clear previous errors
  ['reg-name-error','reg-email-error','reg-password-error'].forEach(id => {
    document.getElementById(id).textContent = '';
  });

  const role = document.querySelector('input[name="role"]:checked')?.value;

  try {
    const data = await post('/auth/register', {
      name:     document.getElementById('reg-name').value.trim(),
      email:    document.getElementById('reg-email').value.trim(),
      password: document.getElementById('reg-password').value,
      role,
    });
    setUser(data.user, data.token);
    flash(`Account created! Welcome, ${data.user.name.split(' ')[0]}! 🎉`, 'success');
    navigate('dashboard');
  } catch (err) {
    if (err.data?.errors) {
      err.data.errors.forEach(e => {
        const errField = document.getElementById(`reg-${e.field}-error`);
        if (errField) errField.textContent = e.message;
        else errEl.textContent = e.message;
      });
    } else {
      errEl.textContent = err.message;
    }
  } finally {
    btn.textContent = 'Create account'; btn.disabled = false;
  }
};

const logout = async () => {
  try { await post('/auth/logout'); } catch {}
  clearUser();
  flash('Signed out successfully.', 'info');
  navigate('home');
};

// Role selector UX
document.querySelectorAll('.role-option').forEach(opt => {
  opt.addEventListener('click', () => {
    document.querySelectorAll('.role-option').forEach(o => o.classList.remove('selected'));
    opt.classList.add('selected');
    opt.querySelector('input').checked = true;
  });
});

// ── DASHBOARD ─────────────────────────────────────────────────────────────────

const initDashboard = () => {
  if (!state.user) { navigate('login'); return; }

  const nav  = document.getElementById('dashboard-nav');
  const main = document.getElementById('dashboard-main');

  if (state.user.role === 'job_seeker') {
    nav.innerHTML = `
      <div class="sidebar-nav-title">Job Seeker</div>
      <button class="sidebar-nav-item active" id="tab-overview"   onclick="dashTab('overview')">📊 Overview</button>
      <button class="sidebar-nav-item"         id="tab-applied"    onclick="dashTab('applied')">📋 My Applications</button>
      <button class="sidebar-nav-item"         id="tab-saved"      onclick="dashTab('saved')">🔖 Saved Jobs</button>
      <button class="sidebar-nav-item"         id="tab-profile"    onclick="dashTab('profile')">👤 My Profile</button>
    `;
    dashTab(state.dashboardTab || 'overview');
  } else {
    nav.innerHTML = `
      <div class="sidebar-nav-title">Employer</div>
      <button class="sidebar-nav-item active" id="tab-overview"    onclick="dashTab('overview')">📊 Overview</button>
      <button class="sidebar-nav-item"         id="tab-my-jobs"    onclick="dashTab('my-jobs')">📋 My Job Posts</button>
      <button class="sidebar-nav-item"         id="tab-profile"    onclick="dashTab('profile')">👤 My Profile</button>
    `;
    dashTab(state.dashboardTab || 'overview');
  }
};

const dashTab = async (tab) => {
  state.dashboardTab = tab;
  document.querySelectorAll('.sidebar-nav-item').forEach(el => el.classList.remove('active'));
  const active = document.getElementById(`tab-${tab}`);
  if (active) active.classList.add('active');

  const main = document.getElementById('dashboard-main');
  main.innerHTML = '<div class="spinner"></div>';

  if (state.user.role === 'job_seeker') {
    switch (tab) {
      case 'overview': await renderSeekerOverview(main); break;
      case 'applied':  await renderMyApplications(main); break;
      case 'saved':    await renderSavedJobs(main); break;
      case 'profile':  renderProfile(main); break;
    }
  } else {
    switch (tab) {
      case 'overview': await renderEmployerOverview(main); break;
      case 'my-jobs':  await renderMyJobs(main); break;
      case 'profile':  renderProfile(main); break;
    }
  }
};

// ── SEEKER DASHBOARD ──────────────────────────────────────────────────────────

const renderSeekerOverview = async (main) => {
  try {
    const [appData, savedData] = await Promise.all([
      get('/applications'),
      get('/saved-jobs'),
    ]);
    const apps   = appData.applications;
    const saved  = savedData.jobs;
    const pending    = apps.filter(a => a.status === 'pending').length;
    const shortlisted = apps.filter(a => a.status === 'shortlisted').length;

    main.innerHTML = `
      <div class="dashboard-header">
        <h1 class="dashboard-title">Welcome back, ${esc(state.user.name.split(' ')[0])}! 👋</h1>
        <p class="dashboard-sub">Here's a snapshot of your job search.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-num">${apps.length}</div>
          <div class="stat-lbl">Total Applications</div>
        </div>
        <div class="stat-card green">
          <div class="stat-num">${shortlisted}</div>
          <div class="stat-lbl">Shortlisted</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-num">${saved.length}</div>
          <div class="stat-lbl">Saved Jobs</div>
        </div>
      </div>

      <div style="background:white;border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow-sm);border:1.5px solid var(--grey-200);margin-bottom:16px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
          <h3 style="font-family:var(--font-hd);font-size:1rem;font-weight:700;color:var(--navy);">Recent Applications</h3>
          <button class="btn btn-ghost btn-sm" onclick="dashTab('applied')">View all</button>
        </div>
        ${apps.length === 0
          ? `<div class="empty-state"><div class="empty-icon">📋</div><h3>No applications yet</h3><p>Browse jobs and start applying!</p><button class="btn btn-primary" onclick="navigate('jobs')">Browse Jobs</button></div>`
          : `<div class="table-wrap"><table>
            <thead><tr><th>Job</th><th>Company</th><th>Status</th><th>Applied</th></tr></thead>
            <tbody>${apps.slice(0,5).map(a => `
              <tr onclick="openJobDetail(${a.job_id})" style="cursor:pointer;">
                <td><strong>${esc(a.job_title)}</strong></td>
                <td>${esc(a.company)}</td>
                <td><span class="tag tag-status-${a.status}">${a.status.charAt(0).toUpperCase()+a.status.slice(1)}</span></td>
                <td style="color:var(--grey-400);font-size:.8rem;">${timeAgo(a.applied_at)}</td>
              </tr>`).join('')}
            </tbody></table></div>`
        }
      </div>

      <div style="text-align:center;">
        <button class="btn btn-primary btn-lg" onclick="navigate('jobs')">Browse all jobs →</button>
      </div>
    `;
  } catch (err) {
    main.innerHTML = `<p style="color:var(--red);">${err.message}</p>`;
  }
};

const renderMyApplications = async (main) => {
  try {
    const data = await get('/applications');
    const apps = data.applications;

    main.innerHTML = `
      <div class="dashboard-header">
        <h1 class="dashboard-title">My Applications</h1>
        <p class="dashboard-sub">${apps.length} application${apps.length !== 1 ? 's' : ''} submitted</p>
      </div>
      ${apps.length === 0
        ? `<div class="empty-state"><div class="empty-icon">📋</div><h3>No applications yet</h3><p>Find jobs you love and apply with a single click.</p><button class="btn btn-primary" onclick="navigate('jobs')">Browse Jobs</button></div>`
        : `<div style="background:white;border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow-sm);border:1.5px solid var(--grey-200);">
          <div class="table-wrap"><table>
            <thead><tr><th>Job</th><th>Company</th><th>Type</th><th>Status</th><th>Applied</th><th>Action</th></tr></thead>
            <tbody>${apps.map(a => `
              <tr>
                <td><a href="#" onclick="openJobDetail(${a.job_id})" style="font-weight:600;color:var(--navy);">${esc(a.job_title)}</a></td>
                <td>${esc(a.company)}</td>
                <td><span class="tag tag-type" style="font-size:.72rem;">${esc(a.job_type||'')}</span></td>
                <td><span class="tag tag-status-${a.status}">${a.status.charAt(0).toUpperCase()+a.status.slice(1)}</span></td>
                <td style="color:var(--grey-400);font-size:.8rem;">${timeAgo(a.applied_at)}</td>
                <td>
                  ${a.status === 'pending'
                    ? `<button class="btn btn-danger btn-sm" onclick="withdrawApp(${a.id})">Withdraw</button>`
                    : '—'}
                </td>
              </tr>`).join('')}
            </tbody></table></div>
        </div>`
      }`;
  } catch (err) {
    main.innerHTML = `<p style="color:var(--red);">${err.message}</p>`;
  }
};

const withdrawApp = async (appId) => {
  if (!confirm('Withdraw this application? This cannot be undone.')) return;
  try {
    await del(`/applications/${appId}`);
    flash('Application withdrawn.', 'info');
    await renderMyApplications(document.getElementById('dashboard-main'));
  } catch (err) { flash(err.message, 'error'); }
};

const renderSavedJobs = async (main) => {
  try {
    const data = await get('/saved-jobs');
    const jobs = data.jobs;

    main.innerHTML = `
      <div class="dashboard-header">
        <h1 class="dashboard-title">Saved Jobs</h1>
        <p class="dashboard-sub">${jobs.length} job${jobs.length !== 1 ? 's' : ''} bookmarked</p>
      </div>
      ${jobs.length === 0
        ? `<div class="empty-state"><div class="empty-icon">🔖</div><h3>No saved jobs yet</h3><p>Bookmark jobs to review and apply to them later.</p><button class="btn btn-primary" onclick="navigate('jobs')">Browse Jobs</button></div>`
        : jobs.map(j => `
          <div class="job-card" onclick="openJobDetail(${j.id})">
            <div class="job-card-company">${esc(j.company)}</div>
            <div class="job-card-title">${esc(j.title)}</div>
            <div class="job-card-meta">
              <span class="meta-item">📍 ${esc(j.location)}</span>
              ${j.salary ? `<span class="meta-item">💰 ₹${Number(j.salary).toLocaleString('en-IN')}</span>` : ''}
            </div>
            <div class="job-card-footer">
              <span class="tag tag-type">${esc(j.job_type)}</span>
              <button class="btn btn-danger btn-sm" onclick="event.stopPropagation();removeSaved(${j.id})">Remove</button>
            </div>
          </div>`).join('')
      }`;
  } catch (err) {
    main.innerHTML = `<p style="color:var(--red);">${err.message}</p>`;
  }
};

const removeSaved = async (jobId) => {
  try {
    await del(`/jobs/${jobId}/save`);
    flash('Removed from saved jobs.', 'info');
    await renderSavedJobs(document.getElementById('dashboard-main'));
  } catch (err) { flash(err.message, 'error'); }
};

// ── EMPLOYER DASHBOARD ────────────────────────────────────────────────────────

const renderEmployerOverview = async (main) => {
  try {
    const data = await get('/jobs/employer/my-jobs');
    const jobs = data.jobs;
    const totalApps = jobs.reduce((sum, j) => sum + parseInt(j.application_count || 0), 0);
    const activeJobs = jobs.filter(j => j.is_active).length;

    main.innerHTML = `
      <div class="dashboard-header">
        <h1 class="dashboard-title">Employer Dashboard 🏢</h1>
        <p class="dashboard-sub">Manage your job postings and view applicants.</p>
      </div>

      <div class="stats-grid">
        <div class="stat-card">
          <div class="stat-num">${jobs.length}</div>
          <div class="stat-lbl">Total Jobs Posted</div>
        </div>
        <div class="stat-card green">
          <div class="stat-num">${activeJobs}</div>
          <div class="stat-lbl">Active Listings</div>
        </div>
        <div class="stat-card amber">
          <div class="stat-num">${totalApps}</div>
          <div class="stat-lbl">Total Applications</div>
        </div>
      </div>

      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <h2 style="font-family:var(--font-hd);font-size:1.1rem;color:var(--navy);">Your Recent Postings</h2>
        <button class="btn btn-primary" onclick="navigate('post-job')">+ Post a Job</button>
      </div>

      ${jobs.length === 0
        ? `<div class="empty-state"><div class="empty-icon">📋</div><h3>No job postings yet</h3><p>Start attracting candidates by posting your first job.</p><button class="btn btn-primary" onclick="navigate('post-job')">Post a Job</button></div>`
        : `<div style="background:white;border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow-sm);border:1.5px solid var(--grey-200);">
          <div class="table-wrap"><table>
            <thead><tr><th>Title</th><th>Type</th><th>Applicants</th><th>Status</th><th>Posted</th><th>Actions</th></tr></thead>
            <tbody>${jobs.slice(0,5).map(j => `
              <tr>
                <td><strong style="cursor:pointer;" onclick="openJobDetail(${j.id})">${esc(j.title)}</strong></td>
                <td><span class="tag tag-type" style="font-size:.72rem;">${esc(j.job_type)}</span></td>
                <td><span style="font-weight:600;">${j.application_count}</span></td>
                <td><span class="tag ${j.is_active ? 'tag-status-shortlisted' : 'tag-status-rejected'}">${j.is_active ? 'Active' : 'Closed'}</span></td>
                <td style="color:var(--grey-400);font-size:.8rem;">${timeAgo(j.created_at)}</td>
                <td style="display:flex;gap:6px;">
                  <button class="btn btn-ghost btn-sm" onclick="openJobDetail(${j.id})">View</button>
                  <button class="btn btn-secondary btn-sm" onclick="viewApplicants(${j.id},'${esc(j.title).replace(/'/g,"\\'")}')">Applicants</button>
                </td>
              </tr>`).join('')}
            </tbody></table></div>
        </div>`
      }`;
  } catch (err) {
    main.innerHTML = `<p style="color:var(--red);">${err.message}</p>`;
  }
};

const renderMyJobs = async (main) => {
  try {
    const data = await get('/jobs/employer/my-jobs');
    const jobs = data.jobs;

    main.innerHTML = `
      <div class="dashboard-header" style="display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h1 class="dashboard-title">My Job Posts</h1>
          <p class="dashboard-sub">${jobs.length} posting${jobs.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="btn btn-primary" onclick="navigate('post-job')">+ Post New Job</button>
      </div>
      ${jobs.length === 0
        ? `<div class="empty-state"><div class="empty-icon">📋</div><h3>No postings yet</h3><button class="btn btn-primary" onclick="navigate('post-job')">Post a Job</button></div>`
        : jobs.map(j => `
          <div class="job-card">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;">
              <div style="flex:1;">
                <div class="job-card-company">${esc(j.company)}</div>
                <div class="job-card-title" style="cursor:pointer;" onclick="openJobDetail(${j.id})">${esc(j.title)}</div>
                <div class="job-card-meta">
                  <span class="meta-item">📍 ${esc(j.location)}</span>
                  <span class="meta-item">👥 ${j.application_count} applicants</span>
                  <span class="meta-item">📅 ${timeAgo(j.created_at)}</span>
                </div>
              </div>
              <div>
                <span class="tag ${j.is_active ? 'tag-status-shortlisted' : 'tag-status-rejected'}">${j.is_active ? 'Active' : 'Closed'}</span>
              </div>
            </div>
            <div class="job-card-footer" style="margin-top:12px;">
              <div class="job-card-tags">
                <span class="tag tag-type">${esc(j.job_type)}</span>
                ${j.experience_level ? `<span class="tag tag-level">${esc(j.experience_level)}</span>` : ''}
              </div>
              <div style="display:flex;gap:8px;">
                <button class="btn btn-ghost btn-sm" onclick="viewApplicants(${j.id},'${esc(j.title).replace(/'/g,"\\'")}')">View Applicants (${j.application_count})</button>
                <button class="btn btn-secondary btn-sm" onclick="editJob(${j.id})">Edit</button>
                <button class="btn btn-danger btn-sm" onclick="deleteJob(${j.id})">Delete</button>
              </div>
            </div>
          </div>`).join('')
      }`;
  } catch (err) {
    main.innerHTML = `<p style="color:var(--red);">${err.message}</p>`;
  }
};

const viewApplicants = async (jobId, jobTitle) => {
  const main = document.getElementById('dashboard-main');
  main.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
      <button class="btn btn-ghost btn-sm" onclick="dashTab('my-jobs')">← Back</button>
      <h1 class="dashboard-title">Applicants: ${esc(jobTitle)}</h1>
    </div>
    <div class="spinner"></div>`;

  try {
    const data = await get(`/jobs/${jobId}/applicants`);
    const applicants = data.applicants;

    const appTable = applicants.length === 0
      ? `<div class="empty-state"><div class="empty-icon">👥</div><h3>No applications yet</h3><p>Share your job posting to attract candidates.</p></div>`
      : `<div style="background:white;border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow-sm);border:1.5px solid var(--grey-200);">
          <div class="table-wrap"><table>
            <thead><tr><th>Applicant</th><th>Email</th><th>Status</th><th>Applied</th><th>Cover Letter</th><th>Update Status</th></tr></thead>
            <tbody>${applicants.map(a => `
              <tr>
                <td><strong>${esc(a.applicant_name)}</strong></td>
                <td style="color:var(--grey-400);font-size:.85rem;">${esc(a.applicant_email)}</td>
                <td><span class="tag tag-status-${a.status}" id="status-tag-${a.id}">${a.status}</span></td>
                <td style="color:var(--grey-400);font-size:.8rem;">${timeAgo(a.applied_at)}</td>
                <td style="max-width:180px;font-size:.8rem;color:var(--grey-600);">${a.cover_letter ? esc(a.cover_letter).substring(0,80)+'…' : '<em>No cover letter</em>'}</td>
                <td>
                  <select class="filter-select" onchange="updateAppStatus(${jobId}, ${a.id}, this.value)" style="font-size:.8rem;padding:5px 8px;">
                    <option value="">Change…</option>
                    ${['pending','reviewed','shortlisted','rejected','hired'].map(s =>
                      `<option value="${s}" ${a.status===s?'selected':''}>${s}</option>`
                    ).join('')}
                  </select>
                </td>
              </tr>`).join('')}
            </tbody></table></div>
        </div>`;

    main.querySelector('.spinner').remove();
    main.insertAdjacentHTML('beforeend', `<p style="color:var(--grey-400);font-size:.85rem;margin-bottom:16px;">${applicants.length} applicant${applicants.length !== 1 ? 's' : ''}</p>${appTable}`);
  } catch (err) {
    main.querySelector('.spinner').outerHTML = `<p style="color:var(--red);">${err.message}</p>`;
  }
};

const updateAppStatus = async (jobId, appId, status) => {
  if (!status) return;
  try {
    await patch(`/jobs/${jobId}/applicants/${appId}`, { status });
    flash(`Application marked as ${status}.`, 'success');
    const tag = document.getElementById(`status-tag-${appId}`);
    if (tag) {
      tag.className = `tag tag-status-${status}`;
      tag.textContent = status;
    }
  } catch (err) { flash(err.message, 'error'); }
};

// ── POST / EDIT JOB ───────────────────────────────────────────────────────────

const initPostJobPage = async (params = {}) => {
  if (!state.user || state.user.role !== 'employer') { navigate('login'); return; }

  const editId = params.editJobId;
  document.getElementById('edit-job-id').value = editId || '';

  if (editId) {
    document.getElementById('post-job-title').textContent = 'Edit Job Posting';
    document.getElementById('post-job-subtitle').textContent = 'Update the details below.';
    document.getElementById('job-submit-btn').textContent = 'Save Changes';

    try {
      const data = await get(`/jobs/${editId}`);
      const j = data.job;
      document.getElementById('job-title').value       = j.title;
      document.getElementById('job-company').value     = j.company;
      document.getElementById('job-location').value    = j.location;
      document.getElementById('job-salary').value      = j.salary || '';
      document.getElementById('job-type').value        = j.job_type;
      document.getElementById('job-level').value       = j.experience_level || '';
      document.getElementById('job-description').value = j.description;
      document.getElementById('job-requirements').value = j.requirements || '';
      document.getElementById('job-benefits').value    = j.benefits || '';
    } catch (err) { flash(err.message, 'error'); }
  } else {
    document.getElementById('post-job-title').textContent = 'Post a New Job';
    document.getElementById('post-job-subtitle').textContent = 'Fill in the details below to publish your job listing.';
    document.getElementById('job-submit-btn').textContent = 'Publish Job';
    document.getElementById('job-form').reset();
    document.getElementById('edit-job-id').value = '';
  }
};

const editJob = (jobId) => {
  navigate('post-job', { editJobId: jobId });
};

const handleJobSubmit = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('job-submit-btn');
  const errEl = document.getElementById('job-form-error');
  btn.disabled = true; btn.textContent = 'Saving…'; errEl.textContent = '';

  const editId = document.getElementById('edit-job-id').value;
  const payload = {
    title:            document.getElementById('job-title').value.trim(),
    company:          document.getElementById('job-company').value.trim(),
    location:         document.getElementById('job-location').value.trim(),
    salary:           document.getElementById('job-salary').value || null,
    job_type:         document.getElementById('job-type').value,
    experience_level: document.getElementById('job-level').value || null,
    description:      document.getElementById('job-description').value.trim(),
    requirements:     document.getElementById('job-requirements').value.trim() || null,
    benefits:         document.getElementById('job-benefits').value.trim() || null,
  };

  try {
    if (editId) {
      await put(`/jobs/${editId}`, payload);
      flash('Job updated!', 'success');
    } else {
      await post('/jobs', payload);
      flash('Job published! 🎉', 'success');
    }
    navigate('dashboard');
    state.dashboardTab = 'my-jobs';
  } catch (err) {
    if (err.data?.errors) {
      errEl.textContent = err.data.errors.map(e => e.message).join(' • ');
    } else {
      errEl.textContent = err.message;
    }
  } finally {
    btn.disabled = false;
    btn.textContent = editId ? 'Save Changes' : 'Publish Job';
  }
};

const deleteJob = async (jobId) => {
  if (!confirm('Delete this job posting? All applications will also be deleted. This cannot be undone.')) return;
  try {
    await del(`/jobs/${jobId}`);
    flash('Job deleted.', 'info');
    await renderMyJobs(document.getElementById('dashboard-main'));
  } catch (err) { flash(err.message, 'error'); }
};

// ── PROFILE ───────────────────────────────────────────────────────────────────

const renderProfile = (main) => {
  main.innerHTML = `
    <div class="dashboard-header">
      <h1 class="dashboard-title">My Profile</h1>
      <p class="dashboard-sub">Manage your account details.</p>
    </div>

    <div style="background:white;border-radius:var(--radius-lg);padding:28px;box-shadow:var(--shadow-sm);border:1.5px solid var(--grey-200);max-width:540px;">
      <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px;padding-bottom:20px;border-bottom:1.5px solid var(--grey-100);">
        <div style="width:56px;height:56px;border-radius:50%;background:var(--blue);color:white;display:flex;align-items:center;justify-content:center;font-family:var(--font-hd);font-size:1.4rem;font-weight:700;">
          ${state.user.name[0].toUpperCase()}
        </div>
        <div>
          <div style="font-family:var(--font-hd);font-size:1.1rem;font-weight:700;">${esc(state.user.name)}</div>
          <div style="color:var(--grey-400);font-size:.85rem;">${esc(state.user.email)}</div>
          <span class="tag tag-type" style="margin-top:4px;">${state.user.role === 'employer' ? '🏢 Employer' : '👤 Job Seeker'}</span>
        </div>
      </div>

      <form onsubmit="saveProfile(event)">
        <div class="form-group">
          <label class="form-label">Full Name</label>
          <input class="form-control" type="text" id="profile-name" value="${esc(state.user.name)}">
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-control" type="email" value="${esc(state.user.email)}" disabled style="opacity:.6;">
          <span class="form-hint">Email cannot be changed.</span>
        </div>
        <div class="form-group">
          <label class="form-label">Bio</label>
          <textarea class="form-control" id="profile-bio" rows="4">${esc(state.user.bio || '')}</textarea>
        </div>
        <button class="btn btn-primary" type="submit" id="profile-save-btn">Save Changes</button>
        <p id="profile-msg" style="margin-top:10px;font-size:.85rem;"></p>
      </form>
    </div>`;
};

const saveProfile = async (e) => {
  e.preventDefault();
  const btn = document.getElementById('profile-save-btn');
  const msgEl = document.getElementById('profile-msg');
  btn.disabled = true; btn.textContent = 'Saving…';

  try {
    const data = await put('/auth/profile', {
      name: document.getElementById('profile-name').value.trim(),
      bio:  document.getElementById('profile-bio').value.trim(),
    });
    setUser({ ...state.user, ...data.user }, state.token);
    msgEl.style.color = 'var(--green)'; msgEl.textContent = '✓ Profile updated!';
    flash('Profile updated!', 'success');
  } catch (err) {
    msgEl.style.color = 'var(--red)'; msgEl.textContent = err.message;
  } finally {
    btn.disabled = false; btn.textContent = 'Save Changes';
  }
};

// ── UTILITIES ─────────────────────────────────────────────────────────────────

// Escape HTML to prevent XSS when inserting user content into innerHTML
const esc = (str) => {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr);
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7)   return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' });
};

const toggleMobileMenu = () => {
  const links = document.getElementById('nav-links');
  links.style.display = links.style.display === 'flex' ? 'none' : 'flex';
  links.style.flexDirection = 'column';
  links.style.position = 'absolute';
  links.style.top = '64px'; links.style.left = '0'; links.style.right = '0';
  links.style.background = 'var(--navy)'; links.style.padding = '12px';
};

// Close apply modal when clicking overlay
document.getElementById('apply-modal').addEventListener('click', (e) => {
  if (e.target === e.currentTarget) closeApplyModal();
});

// ── INIT ───────────────────────────────────────────────────────────────────────

(async () => {
  await restoreSession();
  initHomePage();
})();
