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

type LearnedAnswer = {
  phrase: string;
  field: keyof BookingDraft;
  value: string;
  count: number;
  updatedAt: string;
};

const bookingKey = 'cleanai_booking_draft';
const bookingStartedKey = 'cleanai_booking_started';
const guidedPromptShownKey = 'cleanai_guided_prompt_shown';
const nlpMemoryKey = 'cleanai_nlp_memory';
const submittedBookingKey = 'cleanai_submitted_booking_id';
const requiredFields: Array<keyof BookingDraft> = ['category', 'address', 'propertySize', 'frequency', 'dateTime'];
let submitInFlight = false;

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

function normalize(value: string) {
  return value.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9åäö\s:-]/gi, ' ').replace(/\s+/g, ' ').trim();
}

function readMemory(): LearnedAnswer[] {
  try {
    const raw = localStorage.getItem(nlpMemoryKey);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function rememberAnswer(field: keyof BookingDraft, value: string, phrase = value) {
  const cleanValue = String(value || '').trim();
  const cleanPhrase = normalize(phrase || cleanValue);
  if (!cleanValue || !cleanPhrase) return;
  const memory = readMemory();
  const existing = memory.find((item) => item.phrase === cleanPhrase && item.field === field);
  if (existing) {
    existing.value = cleanValue;
    existing.count += 1;
    existing.updatedAt = new Date().toISOString();
  } else {
    memory.unshift({ phrase: cleanPhrase, field, value: cleanValue, count: 1, updatedAt: new Date().toISOString() });
  }
  localStorage.setItem(nlpMemoryKey, JSON.stringify(memory.slice(0, 80)));
}

function memoryPatch(message: string): BookingDraft {
  const phrase = normalize(message);
  const hit = readMemory().find((item) => item.phrase === phrase || phrase.includes(item.phrase));
  return hit ? { [hit.field]: hit.value } as BookingDraft : {};
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

function isSv() {
  return getCurrentLanguage() === 'sv';
}

function categoryLabel(category?: string) {
  const labels: Record<string, string> = {
    home: isSv() ? 'Privat hem' : 'Private home',
    office: isSv() ? 'Kontor' : 'Office',
    hotel: isSv() ? 'Hotell' : 'Hotel'
  };
  return labels[category || ''] || category || '—';
}

function frequencyLabel(frequency?: string) {
  const labels: Record<string, string> = {
    'One-time': isSv() ? 'Engång' : 'One-time',
    Weekly: isSv() ? 'Veckovis' : 'Weekly',
    Biweekly: isSv() ? 'Varannan vecka' : 'Biweekly'
  };
  return labels[frequency || ''] || frequency || '—';
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
  const submittedId = localStorage.getItem(submittedBookingKey);

  summary.classList.remove('hidden');
  summary.innerHTML = `
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-sm font-semibold text-white">${isSv() ? 'Bokningsutkast' : 'Booking Draft'}</p>
        <span class="pill">${submittedId ? (isSv() ? 'Skickad' : 'Submitted') : missing.length ? (isSv() ? 'Ej komplett' : 'Incomplete') : (isSv() ? 'Klar' : 'Ready')}</span>
      </div>
      ${row(isSv() ? 'Kategori' : 'Category', categoryLabel(draft.category))}
      ${row(isSv() ? 'Adress' : 'Address', draft.address || '—')}
      ${row(isSv() ? 'Storlek' : 'Size', draft.propertySize || '—')}
      ${row(isSv() ? 'Frekvens' : 'Frequency', frequencyLabel(draft.frequency))}
      ${row(isSv() ? 'Tid' : 'Schedule', draft.dateTime || '—')}
      ${row(isSv() ? 'Tillägg' : 'Extras', draft.extras?.length ? draft.extras.join(', ') : '—')}
      <div class="rounded-2xl bg-emerald-500/10 p-3 text-sm text-emerald-100">
        <p class="font-semibold">€${price.total.toFixed(2)}</p>
        <p class="text-xs text-emerald-200">${price.hours} ${isSv() ? 'uppskattade timmar' : 'estimated hours'}</p>
      </div>
      ${submittedId ? `<div class="rounded-2xl bg-white/5 p-3 text-sm text-emerald-200">${isSv() ? 'Bokningen är redan skickad' : 'Booking already submitted'}: ${escapeHTML(submittedId)}</div>` : missing.length ? '' : `<button id="booking-flow-submit" class="btn-primary mt-2 w-full rounded-2xl py-3 text-sm font-semibold">${isSv() ? 'Skicka bokningsutkast' : 'Submit booking draft'}</button>`}
    </div>
  `;

  document.getElementById('booking-flow-submit')?.addEventListener('click', submitBookingDraft);
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
    Object.entries(patchOrMessage).forEach(([field, value]) => {
      if (typeof value === 'string') rememberAnswer(field as keyof BookingDraft, value, value);
    });
    saveBookingDraft(patchOrMessage);
    renderSummary();
    askNextQuestion();
  });
  wrap.appendChild(button);
}

function addLocationButton() {
  const wrap = document.getElementById('quick-replies');
  if (!wrap) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'quick-reply';
  button.textContent = isSv() ? 'Använd min plats' : 'Use my current location';
  button.addEventListener('click', requestLocationAddress);
  wrap.appendChild(button);
}

function questionForField(field: keyof BookingDraft) {
  const copy: Record<string, string> = {
    category: isSv() ? 'Vad vill du boka: privat hem, kontor eller hotell?' : 'What do you need cleaned: private home, office, or hotel?',
    address: isSv() ? 'Vilken adress eller stad ska städaren åka till? Du kan också välja “Använd min plats”.' : 'What address or city should the cleaner go to? You can also choose “Use my current location”.',
    propertySize: isSv() ? 'Hur stor är ytan? Till exempel 2–3 rum eller 80 kvm.' : 'How large is the property? For example, 2–3 bedrooms or 80 sqm.',
    frequency: isSv() ? 'Hur ofta vill du ha städning: engång, veckovis eller varannan vecka?' : 'How often do you want cleaning: one-time, weekly, or biweekly?',
    dateTime: isSv() ? 'Vilken dag och tid passar dig?' : 'Which day and time works for you?'
  };
  return copy[field] || (isSv() ? 'Vad vill du lägga till?' : 'What would you like to add?');
}

function quickRepliesForField(field: keyof BookingDraft) {
  clearQuickReplies();
  if (field === 'category') {
    addQuickReply(isSv() ? 'Privat hem' : 'Private home', { category: 'home' });
    addQuickReply(isSv() ? 'Kontor' : 'Office', { category: 'office' });
    addQuickReply(isSv() ? 'Hotell' : 'Hotel', { category: 'hotel' });
    return;
  }
  if (field === 'address') {
    addLocationButton();
    addQuickReply('Stockholm', { address: 'Stockholm' });
    addQuickReply('Södertälje', { address: 'Södertälje' });
    addQuickReply('Botkyrka', { address: 'Botkyrka' });
    return;
  }
  if (field === 'propertySize') {
    addQuickReply(isSv() ? '1 rum' : 'Studio / 1 room', { propertySize: isSv() ? '1 rum' : 'Studio / 1 room' });
    addQuickReply(isSv() ? '2–3 rum' : '2–3 bedrooms', { propertySize: isSv() ? '2-3 rum' : '2-3 bedrooms' });
    addQuickReply(isSv() ? '4+ rum' : '4+ bedrooms', { propertySize: isSv() ? '4+ rum' : '4+ bedrooms' });
    return;
  }
  if (field === 'frequency') {
    addQuickReply(isSv() ? 'Engång' : 'One-time', { frequency: 'One-time' });
    addQuickReply(isSv() ? 'Veckovis' : 'Weekly', { frequency: 'Weekly' });
    addQuickReply(isSv() ? 'Varannan vecka' : 'Biweekly', { frequency: 'Biweekly' });
    return;
  }
  if (field === 'dateTime') {
    addQuickReply(isSv() ? 'Imorgon 09:00' : 'Tomorrow 09:00', { dateTime: isSv() ? 'Imorgon 09:00' : 'Tomorrow 09:00' });
    addQuickReply(isSv() ? 'Söndag 09:00' : 'Sunday 09:00', { dateTime: isSv() ? 'Söndag 09:00' : 'Sunday 09:00' });
    addQuickReply(isSv() ? 'Nästa vecka' : 'Next week', { dateTime: isSv() ? 'Nästa vecka' : 'Next week' });
  }
}

function inferPatchFromCurrentField(message: string): BookingDraft {
  const value = message.trim();
  if (!value) return {};
  const learned = memoryPatch(value);
  if (Object.keys(learned).length) return learned;

  const nextField = getMissingFields(readBookingDraft())[0];
  const lower = normalize(value);

  if (nextField === 'category') {
    if (/office|kontor/.test(lower)) return { category: 'office' };
    if (/hotel|hotell/.test(lower)) return { category: 'hotel' };
    return { category: 'home' };
  }
  if (nextField === 'address') return { address: value.slice(0, 160) };
  if (nextField === 'propertySize') return { propertySize: value.slice(0, 120) };
  if (nextField === 'frequency') {
    if (/weekly|veckovis|varje vecka/.test(lower)) return { frequency: 'Weekly' };
    if (/biweekly|varannan/.test(lower)) return { frequency: 'Biweekly' };
    if (/one|once|engang|engång/.test(lower)) return { frequency: 'One-time' };
    return { frequency: value.slice(0, 80) };
  }
  if (nextField === 'dateTime') return { dateTime: value.slice(0, 120) };
  if (/deep clean|djuprengoring|djuprengöring/.test(lower)) return { extras: ['Deep clean'] };
  return { notes: value.slice(0, 500) };
}

function rememberPatch(patch: BookingDraft, phrase: string) {
  Object.entries(patch).forEach(([field, value]) => {
    if (typeof value === 'string') rememberAnswer(field as keyof BookingDraft, value, phrase);
  });
}

function askNextQuestion() {
  if (localStorage.getItem(submittedBookingKey)) return;
  const missing = getMissingFields(readBookingDraft());
  if (!missing.length) {
    clearQuickReplies();
    addQuickReply(isSv() ? 'Lägg till djuprengöring' : 'Add deep clean', { extras: ['Deep clean'] });
    addQuickReply(isSv() ? 'Skicka bokningsutkast' : 'Submit booking draft', 'submit booking draft');
    appendMessage(isSv() ? 'Bra. Bokningsutkastet är komplett. Kontrollera sammanfattningen och skicka när du är redo.' : 'Great. Your booking draft is complete. Review the summary and submit when you are ready.', 'assistant', 'Assistant');
    return;
  }
  const nextField = missing[0];
  appendMessage(questionForField(nextField), 'assistant', 'Assistant');
  quickRepliesForField(nextField);
}

function applyAiPayload(result: AiResponse) {
  if (result.bookingPatch && Object.keys(result.bookingPatch).length) saveBookingDraft(result.bookingPatch);
  if (result.mode === 'openai' && result.assistantMessage) appendMessage(result.assistantMessage, 'assistant', 'AI');
  renderSummary();
  askNextQuestion();
}

async function requestLocationAddress() {
  if (!navigator.geolocation) {
    appendMessage(isSv() ? 'Din webbläsare stödjer inte platsdelning. Skriv stad eller adress manuellt.' : 'Your browser does not support location sharing. Type city or address manually.', 'assistant', 'Location');
    return;
  }

  appendMessage(isSv() ? 'Jag ber om platsåtkomst. Godkänn i webbläsaren om du vill fylla i adress automatiskt.' : 'I am requesting location permission. Approve it in the browser to autofill address.', 'assistant', 'Location');

  navigator.geolocation.getCurrentPosition(async (position) => {
    const { latitude, longitude } = position.coords;
    let address = `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
    try {
      const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(latitude)}&lon=${encodeURIComponent(longitude)}&accept-language=${getCurrentLanguage()}`;
      const response = await fetch(url, { headers: { Accept: 'application/json' } });
      if (response.ok) {
        const data = await response.json();
        const city = data.address?.city || data.address?.town || data.address?.municipality || data.address?.suburb || data.address?.county;
        const road = data.address?.road;
        address = [road, city].filter(Boolean).join(', ') || data.display_name || address;
      }
    } catch (error) {
      console.warn('Reverse geocoding failed', error);
    }
    saveBookingDraft({ address });
    rememberAnswer('address', address, 'current location');
    renderSummary();
    appendMessage(isSv() ? `Adress/plats sparad: ${address}` : `Address/location saved: ${address}`, 'assistant', 'Location');
    askNextQuestion();
  }, () => {
    appendMessage(isSv() ? 'Platsåtkomst nekades eller misslyckades. Skriv adress eller stad manuellt.' : 'Location permission was denied or failed. Type address or city manually.', 'assistant', 'Location');
  }, { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 });
}

async function submitBookingDraft() {
  const existingId = localStorage.getItem(submittedBookingKey);
  if (existingId) {
    appendMessage(`${isSv() ? 'Bokningen är redan skickad. Boknings-ID' : 'Booking already submitted. Booking ID'}: ${existingId}`, 'assistant', 'Ready');
    renderSummary();
    return;
  }
  if (submitInFlight) return;

  const draft = readBookingDraft();
  if (getMissingFields(draft).length) {
    askNextQuestion();
    return;
  }

  submitInFlight = true;
  document.getElementById('booking-flow-submit')?.setAttribute('disabled', 'true');
  try {
    const response = await fetch('/api/bookings/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ draft, estimate: estimate(draft), user: JSON.parse(localStorage.getItem('cleanai_user') || '{}') })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Booking submit failed');
    const bookingId = result.bookingId || 'created';
    localStorage.setItem(submittedBookingKey, bookingId);
    clearQuickReplies();
    appendMessage(`${isSv() ? 'Bokning skickad. Boknings-ID' : 'Booking submitted. Booking ID'}: ${bookingId}`, 'assistant', 'Ready');
    renderSummary();
  } catch (error) {
    appendMessage(isSv() ? 'Kunde inte skicka bokningen till servern. Kontrollera API/Supabase och försök igen.' : 'Could not submit booking to the server. Check API/Supabase and try again.', 'assistant', 'Error');
    console.error(error);
  } finally {
    submitInFlight = false;
  }
}

async function sendToAi(message: string) {
  const trimmed = message.trim();
  if (!trimmed) return;

  if (/^submit booking draft$/i.test(trimmed)) {
    await submitBookingDraft();
    return;
  }

  appendMessage(trimmed, 'user');
  const input = document.getElementById('custom-reply') as HTMLInputElement | null;
  if (input) input.value = '';

  const localPatch = inferPatchFromCurrentField(trimmed);
  if (Object.keys(localPatch).length) {
    saveBookingDraft(localPatch);
    rememberPatch(localPatch, trimmed);
    renderSummary();
  }

  try {
    const response = await fetch('/api/ai/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: trimmed, lang: getCurrentLanguage(), context: { bookingDraft: readBookingDraft() } })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result?.assistantMessage || 'AI request failed');
    applyAiPayload(result);
  } catch (error) {
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

  if (localStorage.getItem(submittedBookingKey)) return;
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

  if (localStorage.getItem(bookingStartedKey) === 'true') openChat();
  else renderSummary();
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initBookingFlow);
else initBookingFlow();
