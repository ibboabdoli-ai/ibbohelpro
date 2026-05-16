import { initI18n, t, onLanguageChange, openLanguageSelector, getCurrentLanguage, formatWithLocale, applyTranslations } from './i18n.ts';
import { requestLocationAutofill } from './useLocationAutofill.ts';
import { detectIntent } from './nlp/intentEngine.ts';
import { getGuidedPrompt, shouldStayInFlow } from './dialog/flowManager.ts';
import faqEn from '../data/faq.en.json';
import faqSv from '../data/faq.sv.json';
import faqDe from '../data/faq.de.json';
import faqEs from '../data/faq.es.json';
import intentsEn from '../data/intents.en.json';
import intentsSv from '../data/intents.sv.json';
import intentsDe from '../data/intents.de.json';
import intentsEs from '../data/intents.es.json';

const storageKeys = {
  user: 'cleanai_user',
  auth: 'cleanai_auth_token',
  profile: 'cleanai_profile',
  booking: 'cleanai_booking_draft',
  bookings: 'cleanai_bookings',
  providerApplications: 'cleanai_provider_applications',
  jobResponses: 'cleanai_job_responses'
};

const api = {
  aiChat: '/api/ai/chat',
  createBooking: '/api/bookings/create',
  applyProvider: '/api/providers/apply',
  respondJob: '/api/jobs/respond'
};

const faqIndex = { en: faqEn, sv: faqSv, se: faqSv, de: faqDe, es: faqEs };
const intentIndex = { en: intentsEn, sv: intentsSv, se: intentsSv, de: intentsDe, es: intentsEs };

function getLocaleResource(collection, lang) {
  return collection[lang] || collection.en;
}

function $(selector, root = document) {
  return root.querySelector(selector);
}

function $all(selector, root = document) {
  return Array.from(root.querySelectorAll(selector));
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

function read(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Failed to parse storage', key, error);
    return fallback;
  }
}

function escapeHTML(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function setError(id, message) {
  const node = document.getElementById(id);
  if (node) node.textContent = message || '';
}

function getAuth() {
  return read(storageKeys.user, null);
}

function setAuth(user) {
  save(storageKeys.user, user);
  save(storageKeys.auth, { issuedAt: new Date().toISOString(), role: user.role });
}

function requireAuth(expectedRoles) {
  const user = getAuth();
  if (!user) {
    window.location.href = '/login.html';
    return null;
  }
  if (expectedRoles && !expectedRoles.includes(user.role)) {
    window.location.href = user.role === 'provider' ? '/provider-feed.html' : '/onboarding.html';
    return null;
  }
  return user;
}

function logout() {
  localStorage.removeItem(storageKeys.user);
  localStorage.removeItem(storageKeys.auth);
  window.location.href = '/index.html';
}

function getProfile() {
  return read(storageKeys.profile, {});
}

function setProfile(next) {
  const profile = { ...getProfile(), ...next };
  save(storageKeys.profile, profile);
  return profile;
}

function defaultBookingDraft() {
  return {
    category: '',
    address: '',
    propertySize: '',
    frequency: '',
    dateTime: '',
    extras: [],
    notes: '',
    locationConsent: false
  };
}

function getBookingDraft() {
  return { ...defaultBookingDraft(), ...read(storageKeys.booking, {}) };
}

function setBookingDraft(next) {
  const draft = { ...getBookingDraft(), ...next };
  save(storageKeys.booking, draft);
  return draft;
}

function getBookings() {
  return read(storageKeys.bookings, []);
}

function addBooking(record) {
  const bookings = getBookings();
  bookings.unshift(record);
  save(storageKeys.bookings, bookings.slice(0, 20));
}

function estimateBooking(draft) {
  const base = draft.category === 'office' ? 160 : draft.category === 'hotel' ? 180 : 90;
  const frequencyDiscount = draft.frequency === 'Weekly' ? 0.9 : draft.frequency === 'Biweekly' ? 0.95 : 1;
  const extras = Array.isArray(draft.extras) ? draft.extras.length * 20 : 0;
  const total = Math.round((base + extras) * frequencyDiscount);
  const hours = draft.category === 'hotel' ? 3 : draft.category === 'office' ? 2.5 : 2;
  return { currency: 'EUR', total, hours };
}

function missingBookingFields(draft) {
  return ['category', 'address', 'propertySize', 'frequency', 'dateTime'].filter((key) => !draft[key]);
}

function go(path) {
  window.location.href = path;
}

function initLanguage() {
  initI18n();
  document.getElementById('language-launcher')?.addEventListener('click', openLanguageSelector);
  onLanguageChange(() => {
    renderBookingSummary();
    renderProviderApplicationSummary();
  });
}

function initLanding() {
  const form = document.getElementById('landing-intake');
  if (!form) return;
  let selectedSegment = 'home';
  $all('[data-segment]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedSegment = button.dataset.segment;
      $all('[data-segment]').forEach((item) => item.classList.remove('chip-active'));
      button.classList.add('chip-active');
    });
  });
  $('[data-segment="home"]')?.classList.add('chip-active');

  document.getElementById('landing-use-location')?.addEventListener('click', async () => {
    const input = form.querySelector('input[name="location"]');
    await requestLocationAutofill({ input, statusNode: document.getElementById('landing-error') });
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const location = sanitizeText(data.get('location'));
    if (!location) {
      setError('landing-error', t('landing.form.error.location'));
      return;
    }
    setBookingDraft({ category: selectedSegment, address: location });
    go('/register.html');
  });
}

function initAuthForms() {
  document.getElementById('login-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const email = sanitizeText(data.get('email')).toLowerCase();
    const password = sanitizeText(data.get('password'));
    if (!email.includes('@') || password.length < 8) {
      setError('login-error', t('auth.error.invalid'));
      return;
    }
    const existing = read(storageKeys.user, null);
    const role = existing?.role || 'customer';
    setAuth({ email, role, name: existing?.name || email.split('@')[0] });
    go(role === 'provider' ? '/provider-feed.html' : '/onboarding.html');
  });

  document.getElementById('register-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const name = sanitizeText(data.get('name'));
    const email = sanitizeText(data.get('email')).toLowerCase();
    const password = sanitizeText(data.get('password'));
    const role = sanitizeText(data.get('role')) || 'customer';
    if (!name || !email.includes('@') || password.length < 8) {
      setError('register-error', t('auth.error.invalidRegister'));
      return;
    }
    setAuth({ name, email, role });
    setProfile({ role, onboardingComplete: false });
    go(role === 'provider' ? '/provider-onboarding.html' : '/onboarding.html');
  });
}

function initCustomerOnboarding() {
  if (document.body.dataset.page !== 'customer-onboarding') return;
  const user = requireAuth(['customer']);
  if (!user) return;

  const form = document.getElementById('customer-onboarding-form');
  const draft = getBookingDraft();
  if (draft.category) {
    const input = form?.querySelector(`[name="category"][value="${draft.category}"]`);
    if (input) input.checked = true;
  }

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const category = sanitizeText(data.get('category'));
    if (!category) {
      setError('onboarding-error', t('onboarding.error.category'));
      return;
    }
    setProfile({ role: 'customer', onboardingComplete: true, preferredCategory: category });
    setBookingDraft({ category });
    go('/book.html');
  });
}

function renderBookingSummary() {
  const summary = document.getElementById('booking-summary');
  if (!summary) return;
  const draft = getBookingDraft();
  const estimate = estimateBooking(draft);
  const missing = missingBookingFields(draft);
  summary.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-white">${escapeHTML(t('booking.summary.title'))}</p>
        <span class="pill">${missing.length ? escapeHTML(t('booking.summary.incomplete')) : escapeHTML(t('booking.summary.ready'))}</span>
      </div>
      ${summaryRow(t('booking.field.category'), draft.category || '—')}
      ${summaryRow(t('booking.field.address'), draft.address || '—')}
      ${summaryRow(t('booking.field.size'), draft.propertySize || '—')}
      ${summaryRow(t('booking.field.frequency'), draft.frequency || '—')}
      ${summaryRow(t('booking.field.date'), draft.dateTime || '—')}
      ${summaryRow(t('booking.field.extras'), draft.extras?.length ? draft.extras.join(', ') : '—')}
      <div class="rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-100">
        <p class="font-semibold">${escapeHTML(formatWithLocale(estimate.total, { style: 'currency', currency: estimate.currency }))}</p>
        <p class="text-xs text-emerald-200">${escapeHTML(estimate.hours)} ${escapeHTML(t('booking.summary.hours'))}</p>
      </div>
    </div>
  `;
}

function summaryRow(label, value) {
  return `<div class="flex items-start justify-between gap-3 rounded-2xl bg-white/5 p-3 text-sm"><span class="text-gray-400">${escapeHTML(label)}</span><span class="text-right text-white">${escapeHTML(value)}</span></div>`;
}

function appendMessage(role, textValue) {
  const log = document.getElementById('chat-log');
  if (!log) return;
  const bubble = document.createElement('div');
  bubble.className = role === 'assistant' ? 'chat-bubble chat-assistant' : 'chat-bubble chat-user';
  bubble.textContent = textValue;
  log.appendChild(bubble);
  log.scrollTop = log.scrollHeight;
}

function applyBookingPatch(patch) {
  if (!patch || typeof patch !== 'object') return;
  const cleanPatch = {};
  ['category', 'address', 'propertySize', 'frequency', 'dateTime', 'extras', 'notes'].forEach((key) => {
    if (patch[key] !== undefined) cleanPatch[key] = patch[key];
  });
  setBookingDraft(cleanPatch);
  renderBookingSummary();
}

function quickActions(actions) {
  const wrap = document.getElementById('quick-actions');
  if (!wrap) return;
  wrap.innerHTML = '';
  actions?.forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'chip';
    button.textContent = action.label;
    button.addEventListener('click', () => {
      if (action.patch) applyBookingPatch(action.patch);
      if (action.message) sendChatMessage(action.message);
    });
    wrap.appendChild(button);
  });
}

async function sendChatMessage(message) {
  const trimmed = sanitizeText(message, 1000);
  if (!trimmed) return;
  appendMessage('user', trimmed);
  const draft = getBookingDraft();
  const lang = getCurrentLanguage();
  const intent = detectIntent(trimmed, getLocaleResource(intentIndex, lang));
  const guided = getGuidedPrompt({ message: trimmed, draft, intent, lang });
  try {
    const response = await fetch(api.aiChat, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed, lang, context: { bookingDraft: draft, intent, guided } })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'AI request failed');
    applyBookingPatch(result.bookingPatch);
    appendMessage('assistant', result.assistantMessage || guided.message);
    quickActions(result.quickActions || guided.quickActions);
  } catch (error) {
    console.error(error);
    appendMessage('assistant', guided.message || t('booking.chat.fallback'));
    quickActions(guided.quickActions);
  }
}

function initBookingChat() {
  if (document.body.dataset.page !== 'booking') return;
  const user = requireAuth(['customer']);
  if (!user) return;
  const profile = getProfile();
  if (!profile.onboardingComplete) go('/onboarding.html');
  renderBookingSummary();
  appendMessage('assistant', t('booking.chat.welcome'));
  quickActions([{ label: t('booking.quick.weekly'), patch: { frequency: 'Weekly' } }, { label: t('booking.quick.deep'), patch: { extras: ['Deep clean'] } }]);

  document.getElementById('chat-form')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const value = input.value;
    input.value = '';
    sendChatMessage(value);
  });

  document.getElementById('confirm-booking')?.addEventListener('click', submitBooking);
}

async function submitBooking() {
  const draft = getBookingDraft();
  const missing = missingBookingFields(draft);
  if (missing.length) {
    appendMessage('assistant', `${t('booking.missing')} ${missing.join(', ')}`);
    return;
  }
  const estimate = estimateBooking(draft);
  const record = { draft, estimate, submittedAt: new Date().toISOString(), status: 'pending' };
  try {
    const response = await fetch(api.createBooking, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...record, user: getAuth() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Booking failed');
    addBooking({ ...record, bookingId: result.bookingId || crypto.randomUUID?.() || Date.now().toString() });
    appendMessage('assistant', t('booking.confirmed'));
  } catch (error) {
    console.error(error);
    addBooking({ ...record, bookingId: `LOCAL-${Date.now()}` });
    appendMessage('assistant', t('booking.savedLocal'));
  }
}

function initProviderOnboarding() {
  if (document.body.dataset.page !== 'provider-onboarding') return;
  const user = requireAuth(['provider']);
  if (!user) return;
  const form = document.getElementById('provider-onboarding-form');
  const progress = document.getElementById('provider-progress');
  const steps = $all('[data-step]');
  let current = 0;

  function showStep(index) {
    current = Math.max(0, Math.min(index, steps.length - 1));
    steps.forEach((step, stepIndex) => step.classList.toggle('hidden', stepIndex !== current));
    if (progress) progress.style.width = `${((current + 1) / steps.length) * 100}%`;
  }

  $all('[data-next]').forEach((button) => button.addEventListener('click', () => showStep(current + 1)));
  $all('[data-prev]').forEach((button) => button.addEventListener('click', () => showStep(current - 1)));
  showStep(0);
  hydrateProviderForm(form);

  form?.addEventListener('input', () => {
    saveProviderDraft(form);
    renderProviderApplicationSummary();
  });

  form?.addEventListener('submit', submitProviderApplication);
  renderProviderApplicationSummary();
}

function providerFormData(form) {
  const data = new FormData(form);
  return {
    providerType: sanitizeText(data.get('providerType')),
    serviceArea: sanitizeText(data.get('serviceArea')),
    categories: data.getAll('categories').map((item) => sanitizeText(item)).filter(Boolean),
    weekdays: sanitizeText(data.get('weekdays')),
    weekends: sanitizeText(data.get('weekends')),
    hourlyRate: sanitizeText(data.get('hourlyRate')),
    calloutFee: sanitizeText(data.get('calloutFee')),
    verificationFile: form.querySelector('input[type="file"]')?.files?.[0]?.name || '',
    bio: sanitizeText(data.get('bio'), 1200),
    languages: sanitizeText(data.get('languages')),
    portfolio: sanitizeText(data.get('portfolio'))
  };
}

function saveProviderDraft(form) {
  setProfile({ providerDraft: providerFormData(form), providerStatus: 'draft' });
}

function hydrateProviderForm(form) {
  if (!form) return;
  const draft = getProfile().providerDraft || {};
  Object.entries(draft).forEach(([key, value]) => {
    if (Array.isArray(value)) {
      value.forEach((item) => {
        const input = form.querySelector(`[name="${key}"][value="${item}"]`);
        if (input) input.checked = true;
      });
    } else {
      const input = form.querySelector(`[name="${key}"]`);
      if (input && input.type !== 'file') input.value = value;
    }
  });
}

function renderProviderApplicationSummary() {
  const node = document.getElementById('provider-summary');
  if (!node) return;
  const draft = getProfile().providerDraft || {};
  node.innerHTML = `
    ${summaryRow(t('provider.field.area'), draft.serviceArea || '—')}
    ${summaryRow(t('provider.field.categories'), draft.categories?.join(', ') || '—')}
    ${summaryRow(t('provider.field.rate'), draft.hourlyRate || '—')}
    ${summaryRow(t('provider.field.languages'), draft.languages || '—')}
  `;
}

async function submitProviderApplication(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const providerData = providerFormData(form);
  if (!providerData.serviceArea || !providerData.hourlyRate) {
    setError('provider-error', t('provider.error.required'));
    return;
  }
  const application = { ...providerData, status: 'pending', submittedAt: new Date().toISOString(), applicationId: `LOCAL-${Date.now()}` };
  try {
    const response = await fetch(api.applyProvider, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerData, user: getAuth() })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Application failed');
    application.applicationId = result.applicationId || application.applicationId;
  } catch (error) {
    console.error(error);
  }
  const applications = read(storageKeys.providerApplications, []);
  applications.unshift(application);
  save(storageKeys.providerApplications, applications.slice(0, 10));
  setProfile({ providerStatus: 'pending', providerApplicationId: application.applicationId, providerDraft: providerData });
  go('/provider-feed.html');
}

function initProviderFeed() {
  if (document.body.dataset.page !== 'provider-feed') return;
  const user = requireAuth(['provider']);
  if (!user) return;
  const profile = getProfile();
  const status = profile.providerStatus || 'draft';
  const badge = document.getElementById('feed-status');
  if (badge) badge.textContent = status;
  const locked = document.getElementById('feed-locked');
  const list = document.getElementById('feed-list');
  if (status === 'approved') {
    locked?.classList.add('hidden');
    renderDemoJobs(list);
  } else {
    locked?.classList.remove('hidden');
  }
}

function renderDemoJobs(list) {
  if (!list) return;
  const jobs = [
    { id: 'job-1', title: 'Weekly home clean', location: 'Stockholm', price: '€120' },
    { id: 'job-2', title: 'Office evening clean', location: 'Solna', price: '€220' }
  ];
  list.innerHTML = jobs.map((job) => `
    <article class="surface-card rounded-2xl p-4 text-sm">
      <div class="flex items-center justify-between"><p class="font-semibold text-white">${escapeHTML(job.title)}</p><span class="pill">${escapeHTML(job.price)}</span></div>
      <p class="mt-1 text-gray-300">${escapeHTML(job.location)}</p>
      <button class="mt-3 btn-secondary rounded-full px-3 py-1 text-xs" data-job="${escapeHTML(job.id)}">${escapeHTML(t('provider.feed.accept'))}</button>
    </article>
  `).join('');
}

function bindLogout() {
  document.getElementById('logout')?.addEventListener('click', logout);
}

document.addEventListener('DOMContentLoaded', () => {
  initLanguage();
  initLanding();
  initAuthForms();
  initCustomerOnboarding();
  initBookingChat();
  initProviderOnboarding();
  initProviderFeed();
  bindLogout();
});
