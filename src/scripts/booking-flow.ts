export {};

type BookingDraft = {
  category?: string;
  address?: string;
  propertySize?: string;
  frequency?: string;
  dateTime?: string;
  extras?: string[];
  notes?: string;
};

type AiResponse = {
  assistantMessage?: string;
  bookingPatch?: BookingDraft;
  missingFields?: string[];
  quickActions?: Array<{ text?: string; val?: string }>;
  mode?: string;
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

function saveBookingDraft(update: BookingDraft = {}) {
  const current = readBookingDraft();
  const next = { ...current, ...update };
  if (Array.isArray(update.extras)) {
    next.extras = Array.from(new Set([...(current.extras || []), ...update.extras].filter(Boolean)));
  }
  localStorage.setItem(bookingKey, JSON.stringify(next));
  return next;
}

function escapeHTML(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getCurrentLanguage() {
  const lang = localStorage.getItem('lang') || document.documentElement.lang || 'en';
  return lang.startsWith('sv') ? 'sv' : lang.slice(0, 2) || 'en';
}

function categoryLabel(category?: string) {
  const labels: Record<string, string> = {
    home: 'Private home',
    office: 'Office',
    hotel: 'Hotel'
  };
  return labels[category || ''] || category || '—';
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

function appendMessage(message: string, role: 'assistant' | 'user' = 'assistant', meta = '') {
  const stream = document.getElementById('chat-stream');
  if (!stream) return;
  const bubble = document.createElement('div');
  bubble.className = role === 'assistant' ? 'assistant-bubble' : 'user-bubble';
  bubble.textContent = meta ? `${meta}: ${message}` : message;
  stream.appendChild(bubble);
  stream.scrollTop = stream.scrollHeight;
}

function clearQuickReplies() {
  const wrap = document.getElementById('quick-replies');
  if (wrap) wrap.innerHTML = '';
}

function addQuickReply(label: string, patchOrMessage: BookingDraft | string) {
  const wrap = document.getElementById('quick-replies');
  if (!wrap) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quick-reply';
  button.textContent = label;
  button.addEventListener('click', async () => {
    if (typeof patchOrMessage === 'string') {
      await sendToAi(patchOrMessage);
      return;
    }
    saveBookingDraft(patchOrMessage);
    renderSummary();
    appendMessage(`Saved: ${label}`);
  });
  wrap.appendChild(button);
}

function renderInitialQuickReplies() {
  const wrap = document.getElementById('quick-replies');
  if (!wrap || wrap.childElementCount) return;
  addQuickReply('Address: Stockholm', { address: 'Stockholm' });
  addQuickReply('2–3 bedrooms', { propertySize: '2-3 bedrooms' });
  addQuickReply('Weekly', { frequency: 'Weekly' });
  addQuickReply('Sunday 09:00', { dateTime: 'Sunday 09:00' });
  addQuickReply('Deep clean', { extras: ['Deep clean'] });
}

function applyAiPayload(result: AiResponse) {
  if (result.bookingPatch && Object.keys(result.bookingPatch).length) {
    saveBookingDraft(result.bookingPatch);
  }

  const modeLabel = result.mode === 'openai' ? 'AI' : 'Fallback';
  appendMessage(result.assistantMessage || 'I updated your booking draft.', 'assistant', modeLabel);
  renderSummary();

  if (Array.isArray(result.quickActions) && result.quickActions.length) {
    clearQuickReplies();
    result.quickActions.slice(0, 6).forEach((action) => {
      const label = action.text || action.val || 'Continue';
      const value = action.val || action.text || label;
      addQuickReply(label, value);
    });
  }
}

async function sendToAi(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return;

  appendMessage(trimmed, 'user');
  const input = document.getElementById('custom-reply') as HTMLInputElement | null;
  if (input) input.value = '';

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: trimmed,
        lang: getCurrentLanguage(),
        context: { bookingDraft: readBookingDraft() }
      })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.assistantMessage || 'AI request failed');
    applyAiPayload(result);
  } catch (error) {
    appendMessage('AI endpoint is unavailable. I saved your note locally; check OPENAI_API_KEY and deployment logs.', 'assistant', 'Error');
    saveBookingDraft({ notes: trimmed });
    renderSummary();
    console.error(error);
  }
}

function openChat() {
  const empty = document.getElementById('chat-empty-state');
  const chat = document.getElementById('chat-region');
  empty?.classList.add('hidden');
  chat?.classList.remove('hidden');
  localStorage.setItem(bookingStartedKey, 'true');
  renderInitialQuickReplies();
  renderSummary();
  document.getElementById('custom-reply')?.focus();
}

function initBookingFlow() {
  if (document.body.dataset.page !== 'book') return;

  document.getElementById('start-booking')?.addEventListener('click', (event) => {
    event.preventDefault();
    openChat();
  });

  document.getElementById('chat-input')?.addEventListener('submit', async (event) => {
    event.preventDefault();
    const input = document.getElementById('custom-reply') as HTMLInputElement | null;
    await sendToAi(input?.value || '');
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
