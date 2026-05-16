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
const guidedPromptShownKey = 'cleanai_guided_prompt_shown';
const requiredFields: Array<keyof BookingDraft> = ['category', 'address', 'propertySize', 'frequency', 'dateTime'];

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
  const htmlLang = document.documentElement.lang || '';
  const stored = localStorage.getItem('lang') || localStorage.getItem('cleanai_language') || '';
  const lang = htmlLang.startsWith('sv') ? htmlLang : stored || htmlLang || 'en';
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

function getMissingFields(draft = readBookingDraft()) {
  return requiredFields.filter((key) => !String(draft[key] || '').trim());
}

function renderSummary() {
  const draft = readBookingDraft();
  const summary = document.getElementById('booking-summary');
  if (!summary) return;

  const price = estimate(draft);
  const missing = getMissingFields(draft);

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
      ${missing.length ? '' : '<button id="booking-flow-submit" class="btn-primary mt-2 w-full rounded-2xl py-3 text-sm font-semibold">Submit booking draft</button>'}
    </div>
  `;

  document.getElementById('booking-flow-submit')?.addEventListener('click', () => {
    appendMessage('Your booking draft is ready. In the next step we should send this to Supabase and show a booking ID.', 'assistant', 'Ready');
  });
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
    askNextQuestion();
  });
  wrap.appendChild(button);
}

function questionForField(field: keyof BookingDraft) {
  const lang = getCurrentLanguage();
  const sv = lang === 'sv';
  const copy: Record<string, string> = {
    category: sv ? 'Vad vill du boka: privat hem, kontor eller hotell?' : 'What do you need cleaned: private home, office, or hotel?',
    address: sv ? 'Vilken adress eller stad ska städaren åka till?' : 'What address or city should the cleaner go to?',
    propertySize: sv ? 'Hur stor är ytan? Till exempel 2–3 rum eller 80 kvm.' : 'How large is the property? For example, 2–3 bedrooms or 80 sqm.',
    frequency: sv ? 'Hur ofta vill du ha städning: engång, veckovis eller varannan vecka?' : 'How often do you want cleaning: one-time, weekly, or biweekly?',
    dateTime: sv ? 'Vilken dag och tid passar dig?' : 'Which day and time works for you?'
  };
  return copy[field] || (sv ? 'Vad vill du lägga till?' : 'What would you like to add?');
}

function quickRepliesForField(field: keyof BookingDraft) {
  clearQuickReplies();
  if (field === 'category') {
    addQuickReply('Private home', { category: 'home' });
    addQuickReply('Office', { category: 'office' });
    addQuickReply('Hotel', { category: 'hotel' });
    return;
  }
  if (field === 'address') {
    addQuickReply('Stockholm', { address: 'Stockholm' });
    addQuickReply('Södertälje', { address: 'Södertälje' });
    addQuickReply('Botkyrka', { address: 'Botkyrka' });
    return;
  }
  if (field === 'propertySize') {
    addQuickReply('Studio / 1 room', { propertySize: 'Studio / 1 room' });
    addQuickReply('2–3 bedrooms', { propertySize: '2-3 bedrooms' });
    addQuickReply('4+ bedrooms', { propertySize: '4+ bedrooms' });
    return;
  }
  if (field === 'frequency') {
    addQuickReply('One-time', { frequency: 'One-time' });
    addQuickReply('Weekly', { frequency: 'Weekly' });
    addQuickReply('Biweekly', { frequency: 'Biweekly' });
    return;
  }
  if (field === 'dateTime') {
    addQuickReply('Tomorrow 09:00', { dateTime: 'Tomorrow 09:00' });
    addQuickReply('Sunday 09:00', { dateTime: 'Sunday 09:00' });
    addQuickReply('Next week', { dateTime: 'Next week' });
    return;
  }
}

function inferPatchFromCurrentField(message: string): BookingDraft {
  const value = message.trim();
  if (!value) return {};
  const draft = readBookingDraft();
  const nextField = getMissingFields(draft)[0];
  const lower = value.toLowerCase();

  if (nextField === 'category') {
    if (/office|kontor/i.test(value)) return { category: 'office' };
    if (/hotel|hotell/i.test(value)) return { category: 'hotel' };
    return { category: 'home' };
  }

  if (nextField === 'address') {
    return { address: value.slice(0, 160) };
  }

  if (nextField === 'propertySize') {
    return { propertySize: value.slice(0, 120) };
  }

  if (nextField === 'frequency') {
    if (/weekly|veckovis|varje vecka/i.test(value)) return { frequency: 'Weekly' };
    if (/biweekly|varannan/i.test(value)) return { frequency: 'Biweekly' };
    if (/one|once|engång/i.test(value)) return { frequency: 'One-time' };
    return { frequency: value.slice(0, 80) };
  }

  if (nextField === 'dateTime') {
    return { dateTime: value.slice(0, 120) };
  }

  if (/deep clean|djuprengöring/i.test(lower)) return { extras: ['Deep clean'] };
  return { notes: value.slice(0, 500) };
}

function askNextQuestion() {
  const draft = readBookingDraft();
  const missing = getMissingFields(draft);
  if (!missing.length) {
    clearQuickReplies();
    addQuickReply('Add deep clean', { extras: ['Deep clean'] });
    addQuickReply('Submit booking draft', 'submit booking draft');
    appendMessage('Great. Your booking draft is complete. Review the summary and submit when you are ready.', 'assistant', 'Assistant');
    return;
  }
  const nextField = missing[0];
  appendMessage(questionForField(nextField), 'assistant', 'Assistant');
  quickRepliesForField(nextField);
}

function applyAiPayload(result: AiResponse) {
  if (result.bookingPatch && Object.keys(result.bookingPatch).length) {
    saveBookingDraft(result.bookingPatch);
  }

  const modeLabel = result.mode === 'openai' ? 'AI' : 'Fallback';
  if (result.assistantMessage) {
    appendMessage(result.assistantMessage, 'assistant', modeLabel);
  }
  renderSummary();
  askNextQuestion();
}

async function sendToAi(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return;

  if (/^submit booking draft$/i.test(trimmed)) {
    appendMessage('Your booking draft is ready. Next implementation step: submit it to /api/bookings/create and save it in Supabase.', 'assistant', 'Ready');
    return;
  }

  appendMessage(trimmed, 'user');
  const input = document.getElementById('custom-reply') as HTMLInputElement | null;
  if (input) input.value = '';

  const localPatch = inferPatchFromCurrentField(trimmed);
  if (Object.keys(localPatch).length) {
    saveBookingDraft(localPatch);
    renderSummary();
  }

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
    appendMessage('AI endpoint is unavailable. I saved your answer locally and will continue with guided questions.', 'assistant', 'Error');
    renderSummary();
    askNextQuestion();
    console.error(error);
  }
}

function openChat() {
  const empty = document.getElementById('chat-empty-state');
  const chat = document.getElementById('chat-region');
  empty?.classList.add('hidden');
  chat?.classList.remove('hidden');
  localStorage.setItem(bookingStartedKey, 'true');
  renderSummary();
  document.getElementById('custom-reply')?.focus();

  if (localStorage.getItem(guidedPromptShownKey) !== 'true') {
    localStorage.setItem(guidedPromptShownKey, 'true');
    askNextQuestion();
  } else if (!document.getElementById('quick-replies')?.childElementCount) {
    const missing = getMissingFields();
    if (missing.length) quickRepliesForField(missing[0]);
    else askNextQuestion();
  }
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
