const profileKey = 'cleanai_profile';
const userKey = 'cleanai_user';
const jobResponsesKey = 'cleanai_job_responses';

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Unable to read local state', error);
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function clear(node) {
  if (node) node.replaceChildren();
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getProfile() {
  return readJSON(profileKey, {});
}

function setProfile(update) {
  const profile = { ...getProfile(), ...update };
  saveJSON(profileKey, profile);
  return profile;
}

function getUser() {
  return readJSON(userKey, {});
}

function getResponses() {
  const value = readJSON(jobResponsesKey, {});
  return value && typeof value === 'object' ? value : {};
}

function setResponse(jobId, response) {
  const next = getResponses();
  next[jobId] = { response, respondedAt: new Date().toISOString() };
  saveJSON(jobResponsesKey, next);
}

async function postJSON(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function setStage3Status(message, tone = 'neutral') {
  const node = document.getElementById('stage3-provider-status');
  if (!node) return;
  node.textContent = message;
  node.className = `mt-3 text-xs ${tone === 'ok' ? 'text-emerald-200' : tone === 'error' ? 'text-red-200' : 'text-gray-400'}`;
}

async function syncProviderStatus() {
  const profile = getProfile();
  const user = getUser();
  const applicationId = text(profile.providerApplicationId, 120);
  setStage3Status('Checking provider status...');
  try {
    const data = await postJSON('/api/providers/status', {
      applicationId,
      providerEmail: user?.email,
      user
    });
    if (data.status) {
      const updated = setProfile({ providerStatus: data.status, providerApplicationId: data.applicationId || applicationId });
      const badge = document.getElementById('feed-status');
      if (badge) badge.textContent = updated.providerStatus;
      setStage3Status(`Status synced: ${updated.providerStatus}. Mode: ${data.mode}.`, 'ok');
      if (updated.providerStatus === 'approved') {
        document.getElementById('feed-locked')?.classList.add('hidden');
        loadJobs();
      }
    }
  } catch (error) {
    setStage3Status(`Status sync failed: ${error.message}`, 'error');
  }
}

function normalizeJob(job) {
  return {
    id: text(job.id || job.job_id, 120),
    title: text(job.title || 'Cleaning job', 160),
    location: text(job.location || 'Location pending', 160),
    budget: text(job.budget || 'Estimate pending', 80),
    start: text(job.start || job.start_time || 'Schedule pending', 120),
    category: text(job.category || 'cleaning', 80),
    description: text(job.description || '', 500)
  };
}

async function loadJobs() {
  const container = document.getElementById('feed-list');
  if (!container) return;
  clear(container);
  setStage3Status('Loading job feed...');
  try {
    const data = await postJSON('/api/jobs/list', { profile: getProfile(), user: getUser() });
    const jobs = Array.isArray(data.jobs) ? data.jobs.map(normalizeJob) : [];
    renderJobs(jobs, data.mode || 'api');
  } catch (error) {
    setStage3Status(`Job feed failed: ${error.message}`, 'error');
  }
}

async function respond(job, response) {
  setResponse(job.id, response);
  try {
    await postJSON('/api/jobs/respond', { jobId: job.id, response, job, user: getUser(), profile: getProfile() });
    setStage3Status(`Job ${response}: ${job.title}`, 'ok');
  } catch (error) {
    setStage3Status(`Saved local response; remote failed: ${error.message}`, 'error');
  }
  loadJobs();
}

function renderJobs(jobs, mode) {
  const container = document.getElementById('feed-list');
  clear(container);
  const responses = getResponses();

  if (!jobs.length) {
    const empty = document.createElement('div');
    empty.className = 'rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-gray-300';
    empty.textContent = 'No open jobs found.';
    container?.appendChild(empty);
    setStage3Status(`No jobs. Mode: ${mode}.`);
    return;
  }

  jobs.forEach((job) => {
    const response = responses[job.id]?.response;
    const card = document.createElement('article');
    card.className = 'surface-card rounded-2xl p-4 text-sm';
    card.innerHTML = `
      <div class="flex items-center justify-between gap-3">
        <p class="font-semibold text-white">${escapeHTML(job.title)}</p>
        <span class="pill">${escapeHTML(job.budget)}</span>
      </div>
      <p class="mt-1 text-gray-300">${escapeHTML(job.location)}</p>
      <p class="text-xs text-gray-400">${escapeHTML(job.start)} · ${escapeHTML(job.category)}</p>
      ${job.description ? `<p class="mt-2 text-xs text-gray-300">${escapeHTML(job.description)}</p>` : ''}
      <p class="mt-3 text-xs ${response ? 'text-emerald-200' : 'text-gray-400'}">${response ? `Response: ${escapeHTML(response)}` : 'No response yet'}</p>
      <div class="mt-3 flex gap-2">
        <button type="button" class="btn-secondary rounded-full px-3 py-1 text-xs" data-action="accepted">Accept</button>
        <button type="button" class="rounded-full border border-white/10 px-3 py-1 text-xs text-gray-300 hover:border-white/30 hover:text-white" data-action="declined">Decline</button>
      </div>
    `;
    card.querySelector('[data-action="accepted"]')?.addEventListener('click', () => respond(job, 'accepted'));
    card.querySelector('[data-action="declined"]')?.addEventListener('click', () => respond(job, 'declined'));
    container?.appendChild(card);
  });

  setStage3Status(`Loaded ${jobs.length} job(s). Mode: ${mode}.`, 'ok');
}

function addStage3Controls() {
  if (document.getElementById('stage3-provider-controls')) return;
  const target = document.getElementById('feed-locked') || document.getElementById('feed-list');
  const wrapper = document.createElement('div');
  wrapper.id = 'stage3-provider-controls';
  wrapper.className = 'mt-4 rounded-2xl border border-white/10 bg-black/20 p-4';
  wrapper.innerHTML = `
    <div class="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p class="text-sm font-semibold text-white">Stage 3 marketplace sync</p>
        <p class="text-xs text-gray-400">Sync approval status and refresh open jobs from the API.</p>
      </div>
      <div class="flex gap-2">
        <button type="button" id="sync-provider-status" class="btn-secondary rounded-full px-4 py-2 text-xs">Sync status</button>
        <button type="button" id="refresh-job-feed" class="rounded-full border border-white/10 px-4 py-2 text-xs text-gray-300 hover:border-white/30 hover:text-white">Refresh jobs</button>
      </div>
    </div>
    <p id="stage3-provider-status" class="mt-3 text-xs text-gray-400"></p>
  `;
  target?.parentNode?.insertBefore(wrapper, target.nextSibling);
  document.getElementById('sync-provider-status')?.addEventListener('click', syncProviderStatus);
  document.getElementById('refresh-job-feed')?.addEventListener('click', loadJobs);
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.body.dataset.page !== 'provider-feed') return;
  addStage3Controls();
  const profile = getProfile();
  if (profile.providerStatus === 'approved') {
    loadJobs();
  } else {
    setStage3Status('Provider feed is locked until approval. Use Sync status after admin review.');
  }
});
