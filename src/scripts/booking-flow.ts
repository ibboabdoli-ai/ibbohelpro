type BookingDraft = {
  category?: string;
  address?: string;
  propertySize?: string;
  frequency?: string;
  dateTime?: string;
  extras?: string[];
  notes?: string;
};

const bookingKey = 'cleanai_booking_draft';
const bookingStartedKey = 'cleanai_booking_started';

function readBookingDraft(): BookingDraft {
  try {
    const raw = localStorage.getItem(bookingKey);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveBookingDraft(update: BookingDraft) {
  const current = readBookingDraft();
  const next = { ...current, ...update };
  localStorage.setItem(bookingKey, JSON.stringify(next));
  return next;
}

function text(value: unknown, fallback = '—') {
  const output = String(value ?? '').trim();
  return output || fallback;
}

function escapeHTML(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function categoryLabel(category?: string) {
  const labels: Record<string, string> = {
    home: 'Private home',
    office: 'Office',
    hotel: 'Hotel'
  };
  return labels[category || ''] || text(category);
}

function estimate(draft: BookingDraft) {
  const base = draft.category === 'office' ? 160 : draft.category === 'hotel' ? 180 : 90;
  const extraCost = Array.isArray(draft.extras) ? draft.extras.length * 20 : 0;
  const discount = draft.frequency === 'Weekly' ? 0.9 : draft.frequency === 'Biweekly' ? 0.95 : 1;
  const total = Math.round((base + extraCost) * discount);
  const hours = draft.category === 'hotel' ? 3 : draft.category === 'office' ? 2.5 : 2;
  return { total, hours };
}

function renderSummary() {
  const draft = readBookingDraft();
  const summary = document.getElementById('booking-summary');
  if (!summary) return;

  const price = estimate(draft);
  const missing = ['category', 'address', 'propertySize', 'frequency', 'dateTime'].filter((key) => !(draft as any)[key]);

  summary.classList.remove('hidden');
  summary.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-white">Booking Draft</p>
        <span class="pill">${missing.length ? 'Incomplete' : 'Ready'}</span>
      </div>
      ${row('Category', categoryLabel(draft.category))}
      ${row('Address', draft.address || '—')}
      ${row('Size', draft.propertySize || '—')}
      ${row('Frequency', draft.frequency || '—')}
      ${row('Schedule', draft.dateTime || '—')}
      ${row('Extras', draft.extras?.length ? draft.extras.join(', ') : '—')}
      <div class="rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-100">
        <p class="font-semibold">€${price.total.toFixed(2)}</p>
        <p class="text-xs text-emerald-200">${price.hours} estimated hours</p>
      </div>
    </div>
  `;
}

function row(label: string, value: unknown) {
  return `<div class="flex items-start justify-between gap-3 rounded-2xl bg-white/5 p-3 text-sm"><span class="text-gray-400">${escapeHTML(label)}</span><span class="text-right text-white">${escapeHTML(value)}</span></div>`;
}

function appendAssistantMessage(message: string) {
  const stream = document.getElementById('chat-stream');
  if (!stream) return;
  const bubble = document.createElement('div');
  bubble.className = 'assistant-bubble';
  bubble.textContent = message;
  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
}

function addQuickReply(label: string, patch: BookingDraft) {
  const wrap = document.getElementById('quick-replies');
  if (!wrap) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quick-reply';
  button.textContent = label;
  button.addEventListener('click', () => {
    saveBookingDraft(patch);
    renderSummary();
    appendAssistantMessage(`Saved: ${label}`);
  });
  wrap.appendChild(button);
}

function renderQuickReplies() {
  const wrap = document.getElementById('quick-replies');
  if (!wrap || wrap.childElementCount) return;
  addQuickReply('Address: Stockholm', { address: 'Stockholm' });
  addQuickReply('2–3 bedrooms', { propertySize: '2-3 bedrooms' });
  addQuickReply('Weekly', { frequency: 'Weekly' });
  addQuickReply('Sunday 09:00', { dateTime: 'Sunday 09:00' });
  addQuickReply('Deep clean', { extras: ['Deep clean'] });
}

function parseFreeText(value: string): BookingDraft {
  const textValue = value.trim();
  const lower = textValue.toLowerCase();
  const patch: BookingDraft = {};

  if (lower.includes('stockholm')) patch.address = 'Stockholm';
  if (lower.includes('weekly') || lower.includes('veckovis')) patch.frequency = 'Weekly';
  if (lower.includes('biweekly') || lower.includes('varannan')) patch.frequency = 'Biweekly';
  if (lower.includes('deep clean') || lower.includes('djuprengöring')) patch.extras = ['Deep clean'];

  const bedrooms = textValue.match(/(\d+)\s*(-\s*\d+)?\s*(bedroom|bedrooms|room|rooms|rum)/i);
  if (bedrooms) patch.propertySize = bedrooms[0];

  const schedule = textValue.match(/(monday|tuesday|wednesday|thursday|friday|saturday|sunday|måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag).{0,12}(\d{1,2}[:.]?\d{0,2})/i);
  if (schedule) patch.dateTime = schedule[0].replace('.', ':');

  if (!Object.keys(patch).length) patch.notes = textValue;
  return patch;
}

function openChat() {
  const empty = document.getElementById('chat-empty-state');
  const chat = document.getElementById('chat-region');
  empty?.classList.add('hidden');
  chat?.classList.remove('hidden');
  localStorage.setItem(bookingStartedKey, 'true');
  renderQuickReplies();
  renderSummary();
  document.getElementById('custom-reply')?.focus();
}

function initBookingFlow() {
  if (document.body.dataset.page !== 'book') return;

  document.getElementById('start-booking')?.addEventListener('click', (event) => {
    event.preventDefault();
    openChat();
  });

  document.getElementById('chat-input')?.addEventListener('submit', (event) => {
    event.preventDefault();
    const input = document.getElementById('custom-reply') as HTMLInputElement | null;
    const value = input?.value || '';
    if (!value.trim()) return;
    saveBookingDraft(parseFreeText(value));
    if (input) input.value = '';
    appendAssistantMessage('I updated your booking draft.');
    renderSummary();
  });

  if (localStorage.getItem(bookingStartedKey) === 'true') {
    openChat();
  } else {
    renderSummary();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initBookingFlow);
} else {
  initBookingFlow();
}
