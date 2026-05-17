export {};

type ProviderDraft = Record<string, unknown> & {
  type?: string;
  serviceArea?: string;
  categories?: string[];
  weekdays?: string;
  weekends?: string;
  hourlyRate?: string;
  calloutFee?: string;
  verificationFile?: string;
  bio?: string;
  languages?: string;
  portfolio?: string;
};

const profileKey = 'cleanai_profile';
const userKey = 'cleanai_user';
const providerApplicationsKey = 'cleanai_provider_applications';
const steps = ['basics', 'availability', 'pricing', 'verification', 'profile'];
let currentStep = 0;
let submitInFlight = false;

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function profile() {
  return readJSON<Record<string, any>>(profileKey, {});
}

function setProfile(update: Record<string, unknown>) {
  const next = { ...profile(), ...update };
  saveJSON(profileKey, next);
  return next;
}

function text(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function formEl() {
  return document.getElementById('provider-form') as HTMLFormElement | null;
}

function status(message = '', error = false) {
  const feedback = document.getElementById('provider-feedback');
  const err = document.getElementById('provider-error');
  if (feedback) feedback.textContent = error ? '' : message;
  if (err) err.textContent = error ? message : '';
}

async function syncProviderProfile(update: Record<string, unknown>) {
  const user = readJSON<Record<string, unknown>>(userKey, {});
  const nextProfile = setProfile({ role: 'provider', ...update });
  try {
    const response = await fetch('/api/profile/upsert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user, profile: nextProfile })
    });
    if (!response.ok) throw new Error(`Profile sync failed: ${response.status}`);
    const payload = await response.json().catch(() => null);
    if (payload?.profile) setProfile(payload.profile);
    return payload;
  } catch (error) {
    console.warn('Provider profile sync skipped; local state is still saved.', error);
    return null;
  }
}

function collectDraft(): ProviderDraft {
  const form = formEl();
  if (!form) return {};
  const data = new FormData(form);
  const fileInput = document.getElementById('provider-verification-file') as HTMLInputElement | null;
  return {
    type: text(data.get('type'), 60) || 'individual',
    serviceArea: text(data.get('serviceArea'), 160),
    categories: data.getAll('categories').map((item) => text(item, 80)).filter(Boolean),
    weekdays: text(data.get('weekdays'), 160),
    weekends: text(data.get('weekends'), 160),
    hourlyRate: text(data.get('hourlyRate'), 40),
    calloutFee: text(data.get('calloutFee'), 40),
    verificationFile: fileInput?.files?.[0]?.name || text(profile().providerDraft?.verificationFile, 240),
    bio: text(data.get('bio'), 1200),
    languages: text(data.get('languages'), 240),
    portfolio: text(data.get('portfolio'), 300)
  };
}

function saveDraft(showMessage = true) {
  const draft = collectDraft();
  setProfile({ role: 'provider', providerStatus: 'draft', providerDraft: draft, providerStep: currentStep });
  renderSideStatus();
  if (showMessage) status('Draft saved.');
  return draft;
}

function hydrateDraft() {
  const form = formEl();
  if (!form) return;
  const draft: ProviderDraft = profile().providerDraft || {};
  Object.entries(draft).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        const input = form.querySelector<HTMLInputElement>(`[name="${key}"][value="${item}"]`);
        if (input) input.checked = true;
      });
      return;
    }
    const input = form.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(`[name="${key}"]`);
    if (input && input.type !== 'file') input.value = String(value ?? '');
  });
  currentStep = Number(profile().providerStep || 0);
  if (!Number.isFinite(currentStep)) currentStep = 0;
  currentStep = Math.max(0, Math.min(currentStep, steps.length - 1));
}

function renderStep() {
  document.querySelectorAll<HTMLElement>('[data-step]').forEach((step, index) => {
    step.classList.toggle('hidden', index !== currentStep);
  });

  const bar = document.getElementById('provider-progress-bar') as HTMLElement | null;
  const label = document.getElementById('provider-progress-label');
  const prev = document.getElementById('prev-step') as HTMLButtonElement | null;
  const next = document.getElementById('next-step') as HTMLButtonElement | null;

  if (bar) bar.style.width = `${((currentStep + 1) / steps.length) * 100}%`;
  if (label) label.textContent = `Step ${currentStep + 1} of ${steps.length}`;
  if (prev) prev.disabled = currentStep === 0;
  if (next) next.textContent = currentStep === steps.length - 1 ? 'Review' : 'Next';

  setProfile({ providerStep: currentStep });
  status('');
}

function validateCurrentStep() {
  const draft = collectDraft();
  if (steps[currentStep] === 'basics') {
    if (!draft.serviceArea) return 'Add your service area.';
    if (!draft.categories?.length) return 'Choose at least one category.';
  }
  if (steps[currentStep] === 'pricing') {
    if (!draft.hourlyRate) return 'Add your hourly rate.';
  }
  return '';
}

function nextStep() {
  const error = validateCurrentStep();
  if (error) {
    status(error, true);
    return;
  }
  saveDraft(false);
  if (currentStep < steps.length - 1) currentStep += 1;
  renderStep();
  renderSideStatus();
}

function prevStep() {
  saveDraft(false);
  if (currentStep > 0) currentStep -= 1;
  renderStep();
  renderSideStatus();
}

function renderSideStatus() {
  const currentProfile = profile();
  const state = text(currentProfile.providerStatus || 'draft', 40);
  const statusText = state === 'pending' ? 'Pending review' : state === 'approved' ? 'Approved' : 'Draft';
  const statusNode = document.getElementById('provider-status');
  const badge = document.getElementById('provider-badge');
  if (statusNode) statusNode.textContent = statusText;
  if (badge) badge.textContent = statusText;
}

async function submitProvider() {
  if (submitInFlight) return;
  const draft = saveDraft(false);
  if (!draft.serviceArea) {
    status('Add your service area before submitting.', true);
    currentStep = 0;
    renderStep();
    return;
  }
  if (!draft.hourlyRate) {
    status('Add your hourly rate before submitting.', true);
    currentStep = 2;
    renderStep();
    return;
  }

  submitInFlight = true;
  const button = document.getElementById('submit-provider') as HTMLButtonElement | null;
  if (button) button.disabled = true;

  try {
    const user = readJSON(userKey, {});
    const response = await fetch('/api/providers/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerData: draft, user })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Provider application failed');
    const applicationId = result.applicationId || `LOCAL-${Date.now()}`;
    const applications = readJSON<any[]>(providerApplicationsKey, []);
    applications.unshift({ ...draft, status: 'pending', applicationId, submittedAt: new Date().toISOString() });
    saveJSON(providerApplicationsKey, applications.slice(0, 20));
    await syncProviderProfile({ providerStatus: 'pending', providerApplicationId: applicationId, providerDraft: draft, onboardingComplete: true });
    renderSideStatus();
    status(`Submitted for review. Application ID: ${applicationId}`);
  } catch (error) {
    console.error(error);
    status('Could not submit application. Check API/Supabase settings and try again.', true);
  } finally {
    submitInFlight = false;
    if (button) button.disabled = false;
  }
}

function initProviderOnboardingFlow() {
  if (document.body.dataset.page !== 'provider-onboarding') return;
  const user = readJSON<any>(userKey, null);
  if (!user) {
    window.location.href = '/login.html';
    return;
  }
  if (user.role !== 'provider') {
    user.role = 'provider';
    saveJSON(userKey, user);
  }

  hydrateDraft();
  renderStep();
  renderSideStatus();

  formEl()?.addEventListener('input', () => saveDraft(false));
  document.getElementById('next-step')?.addEventListener('click', nextStep);
  document.getElementById('prev-step')?.addEventListener('click', prevStep);
  document.getElementById('save-draft')?.addEventListener('click', () => saveDraft(true));
  document.getElementById('submit-provider')?.addEventListener('click', submitProvider);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initProviderOnboardingFlow);
else initProviderOnboardingFlow();