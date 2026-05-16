const keys = {
  providerApplications: 'cleanai_provider_applications',
  profile: 'cleanai_profile'
};

function readJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Unable to read local data', error);
    return fallback;
  }
}

function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function text(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function clearNode(node) {
  if (node) node.replaceChildren();
}

function appendText(parent, tag, className, value) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  element.textContent = text(value);
  parent.appendChild(element);
  return element;
}

function getAdminCode() {
  return text(document.getElementById('admin-code')?.value, 400);
}

function getLocalApplications() {
  const list = readJSON(keys.providerApplications, []);
  return Array.isArray(list) ? list : [];
}

function setFeedback(message, tone = 'neutral') {
  const node = document.getElementById('admin-feedback');
  if (!node) return;
  node.textContent = message;
  node.className = `mt-4 text-sm ${tone === 'error' ? 'text-red-200' : tone === 'ok' ? 'text-emerald-200' : 'text-gray-300'}`;
}

async function apiJSON(url, body = {}) {
  const code = getAdminCode();
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: code ? `Bearer ${code}` : ''
    },
    body: JSON.stringify(body)
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed: ${response.status}`);
  return data;
}

function normalizeApplication(item) {
  return {
    applicationId: text(item.applicationId || item.application_id, 120),
    status: text(item.status || 'pending', 40),
    providerName: text(item.providerName || item.provider_name || item.name || 'Provider', 180),
    providerEmail: text(item.providerEmail || item.provider_email || item.email, 180),
    providerType: text(item.providerType || item.provider_type || item.type, 80),
    serviceArea: text(item.serviceArea || item.service_area, 240),
    categories: Array.isArray(item.categories) ? item.categories : [],
    weekdays: text(item.weekdays, 160),
    weekends: text(item.weekends, 160),
    hourlyRate: text(item.hourlyRate || item.hourly_rate, 40),
    calloutFee: text(item.calloutFee || item.callout_fee, 40),
    verificationFile: text(item.verificationFile || item.verification_file, 240),
    bio: text(item.bio, 1200),
    languages: text(item.languages, 240),
    portfolio: text(item.portfolio, 300),
    submittedAt: text(item.submittedAt || item.created_at, 120),
    reviewedAt: text(item.reviewedAt || item.reviewed_at, 120)
  };
}

async function loadApplications() {
  setFeedback('Loading applications...');
  let applications = [];
  let mode = 'local-demo';

  if (getAdminCode()) {
    try {
      const data = await apiJSON('/api/admin/list-provider-applications', {});
      applications = Array.isArray(data.applications) ? data.applications : [];
      mode = data.mode || 'api';
    } catch (error) {
      setFeedback(`Remote list failed. Showing local applications. ${error.message}`, 'error');
    }
  }

  if (!applications.length) {
    applications = getLocalApplications();
  }

  renderApplications(applications.map(normalizeApplication), mode);
}

function updateLocalApplication(applicationId, status) {
  const list = getLocalApplications();
  const next = list.map((item) => {
    if ((item.applicationId || item.application_id) !== applicationId) return item;
    return { ...item, status, reviewedAt: new Date().toISOString() };
  });
  saveJSON(keys.providerApplications, next);

  const profile = readJSON(keys.profile, null);
  if (profile?.providerApplicationId === applicationId) {
    saveJSON(keys.profile, { ...profile, providerStatus: status });
  }
}

async function reviewApplication(application, status) {
  const label = status === 'approved' ? 'approving' : 'rejecting';
  setFeedback(`${label} ${application.applicationId}...`);

  if (getAdminCode() && application.applicationId && !application.applicationId.includes('LOCAL')) {
    try {
      await apiJSON('/api/admin/provider-approval', {
        applicationId: application.applicationId,
        status
      });
    } catch (error) {
      setFeedback(`Remote review failed. Applying local demo update. ${error.message}`, 'error');
    }
  }

  updateLocalApplication(application.applicationId, status);
  setFeedback(`Application ${application.applicationId || '(local)'} set to ${status}.`, 'ok');
  loadApplications();
}

function statusClass(status) {
  if (status === 'approved') return 'badge badge-emerald';
  if (status === 'rejected') return 'badge border-red-300/30 bg-red-500/10 text-red-100';
  return 'badge border-amber-300/30 bg-amber-500/10 text-amber-100';
}

function renderApplications(applications, mode) {
  const list = document.getElementById('application-list');
  const count = document.getElementById('application-count');
  clearNode(list);
  if (count) count.textContent = String(applications.length);

  if (!applications.length) {
    const empty = document.createElement('div');
    empty.className = 'rounded-2xl border border-dashed border-white/15 bg-black/20 p-4 text-sm text-gray-300';
    empty.textContent = 'No provider applications found yet.';
    list?.appendChild(empty);
    setFeedback(`No applications found. Mode: ${mode}.`);
    return;
  }

  applications.forEach((application) => {
    const card = document.createElement('article');
    card.className = 'surface-card rounded-2xl p-4 text-sm';

    const header = document.createElement('div');
    header.className = 'flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between';
    const titleBlock = document.createElement('div');
    appendText(titleBlock, 'p', 'text-lg font-semibold text-white', application.providerName || 'Provider');
    appendText(titleBlock, 'p', 'text-xs text-gray-400', application.providerEmail || 'No email');
    appendText(titleBlock, 'p', 'text-xs text-gray-400', application.applicationId || 'No reference');
    const badge = document.createElement('span');
    badge.className = statusClass(application.status);
    badge.textContent = application.status || 'pending';
    header.appendChild(titleBlock);
    header.appendChild(badge);
    card.appendChild(header);

    const grid = document.createElement('div');
    grid.className = 'mt-4 grid gap-3 sm:grid-cols-2';
    [
      ['Area', application.serviceArea],
      ['Type', application.providerType],
      ['Categories', application.categories.join(', ') || '—'],
      ['Rate', application.hourlyRate ? `${application.hourlyRate}/h` : '—'],
      ['Weekdays', application.weekdays || '—'],
      ['Weekends', application.weekends || '—'],
      ['Languages', application.languages || '—'],
      ['Verification', application.verificationFile || '—']
    ].forEach(([label, value]) => {
      const item = document.createElement('div');
      item.className = 'rounded-xl bg-black/20 p-3';
      appendText(item, 'p', 'text-xs uppercase tracking-[0.18em] text-gray-500', label);
      appendText(item, 'p', 'mt-1 text-gray-200', value);
      grid.appendChild(item);
    });
    card.appendChild(grid);

    if (application.bio) {
      appendText(card, 'p', 'mt-3 text-gray-300', application.bio);
    }

    const actions = document.createElement('div');
    actions.className = 'mt-4 flex flex-wrap gap-2';
    const approve = document.createElement('button');
    approve.type = 'button';
    approve.className = 'btn-secondary rounded-full px-4 py-2 text-xs';
    approve.textContent = 'Approve';
    approve.disabled = application.status === 'approved';
    approve.addEventListener('click', () => reviewApplication(application, 'approved'));
    const reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'rounded-full border border-white/10 px-4 py-2 text-xs text-gray-300 hover:border-white/30 hover:text-white';
    reject.textContent = 'Reject';
    reject.disabled = application.status === 'rejected';
    reject.addEventListener('click', () => reviewApplication(application, 'rejected'));
    actions.appendChild(approve);
    actions.appendChild(reject);
    card.appendChild(actions);

    list?.appendChild(card);
  });

  setFeedback(`Loaded ${applications.length} application(s). Mode: ${mode}.`, 'ok');
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('load-applications')?.addEventListener('click', loadApplications);
  loadApplications();
});
