const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = Number(process.env.AI_RATE_LIMIT_MAX || 30);
const buckets = new Map();

const ALLOWED_PATCH_KEYS = ['category', 'address', 'propertySize', 'frequency', 'dateTime', 'extras', 'notes'];
const REQUIRED_BOOKING_FIELDS = ['category', 'address', 'propertySize', 'frequency', 'dateTime'];
const NAV_VALUES = new Set(['pricing', 'booking', 'support', 'features', 'provider']);

const RESPONSE_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  properties: {
    assistantMessage: {
      type: 'string',
      description: 'Short, safe assistant reply in the user language. Never claim a final booking, payment, or provider approval.'
    },
    bookingPatch: {
      type: 'object',
      additionalProperties: false,
      properties: {
        category: { type: ['string', 'null'] },
        address: { type: ['string', 'null'] },
        propertySize: { type: ['string', 'null'] },
        frequency: { type: ['string', 'null'] },
        dateTime: { type: ['string', 'null'] },
        extras: {
          type: 'array',
          items: { type: 'string' }
        },
        notes: { type: ['string', 'null'] }
      },
      required: ['category', 'address', 'propertySize', 'frequency', 'dateTime', 'extras', 'notes']
    },
    missingFields: {
      type: 'array',
      items: { type: 'string', enum: REQUIRED_BOOKING_FIELDS }
    },
    quickActions: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          text: { type: 'string' },
          val: { type: 'string' }
        },
        required: ['text', 'val']
      }
    },
    nav: { type: ['string', 'null'], enum: ['pricing', 'booking', 'support', 'features', 'provider', null] },
    mode: { type: 'string', enum: ['openai'] }
  },
  required: ['assistantMessage', 'bookingPatch', 'missingFields', 'quickActions', 'nav', 'mode']
};

function setHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, body) {
  setHeaders(res);
  return res.status(status).json(body);
}

function asText(value, max = 1200) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
}

function normalizeLang(lang) {
  const value = asText(lang || 'en', 12).toLowerCase();
  if (value === 'se') return 'sv';
  if (['en', 'sv', 'de', 'es'].includes(value)) return value;
  return 'en';
}

function getClientId(req) {
  return asText(req.headers['x-forwarded-for'] || req.headers['x-real-ip'] || req.socket?.remoteAddress || 'unknown', 120).split(',')[0];
}

function isRateLimited(req) {
  const id = getClientId(req);
  const now = Date.now();
  const bucket = buckets.get(id) || { resetAt: now + RATE_LIMIT_WINDOW_MS, count: 0 };
  if (bucket.resetAt < now) {
    bucket.resetAt = now + RATE_LIMIT_WINDOW_MS;
    bucket.count = 0;
  }
  bucket.count += 1;
  buckets.set(id, bucket);
  return bucket.count > RATE_LIMIT_MAX;
}

function collectInput(body = {}) {
  const messages = Array.isArray(body.messages) && body.messages.length ? body.messages : body.message ? [{ content: body.message }] : [];
  const last = messages[messages.length - 1] || {};
  return {
    message: asText(last.content || body.message, 1000),
    lang: normalizeLang(body.lang || 'en'),
    context: body.context && typeof body.context === 'object' ? body.context : {}
  };
}

function cleanBookingPatch(patch = {}) {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return {};
  const clean = {};
  ['category', 'address', 'propertySize', 'frequency', 'dateTime', 'notes'].forEach((key) => {
    const value = asText(patch[key], key === 'notes' ? 700 : 220);
    if (value) clean[key] = value;
  });
  if (Array.isArray(patch.extras)) {
    const extras = patch.extras.map((item) => asText(item, 120)).filter(Boolean).slice(0, 10);
    if (extras.length) clean.extras = extras;
  }
  return clean;
}

function getDraft(context = {}) {
  return context.bookingDraft && typeof context.bookingDraft === 'object' ? context.bookingDraft : {};
}

function computeMissingFields(context = {}, patch = {}) {
  const draft = { ...getDraft(context), ...patch };
  return REQUIRED_BOOKING_FIELDS.filter((field) => !asText(draft[field], 120));
}

function inferSimplePatch(message) {
  const lower = message.toLowerCase();
  const patch = {};

  if (/\b(home|house|apartment|flat|villa|hem|lägenhet|hus)\b/i.test(message)) patch.category = 'home';
  if (/\b(office|kontor)\b/i.test(message)) patch.category = 'office';
  if (/\b(hotel|airbnb|short stay)\b/i.test(message)) patch.category = 'hotel';

  const bedrooms = message.match(/\b(\d+)\s*(bed|bedroom|bedrooms|rum|rok|sovrum)\b/i);
  if (bedrooms) patch.propertySize = `${bedrooms[1]} bedrooms`;
  if (/studio|etta|1:a/i.test(message)) patch.propertySize = 'Studio / 1 room';

  if (/weekly|varje vecka|veckovis/i.test(lower)) patch.frequency = 'Weekly';
  if (/biweekly|every other week|varannan vecka/i.test(lower)) patch.frequency = 'Every other week';
  if (/monthly|månad|månadsvis/i.test(lower)) patch.frequency = 'Monthly';
  if (/one[- ]?time|once|engång/i.test(lower)) patch.frequency = 'One-time';

  const dateLike = message.match(/\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|idag|imorgon|måndag|tisdag|onsdag|torsdag|fredag|lördag|söndag|\d{4}-\d{2}-\d{2}|\d{1,2}[\/-]\d{1,2}(?:[\/-]\d{2,4})?)(?:\s+(?:at|kl\.?|klockan)?\s*\d{1,2}(?::\d{2})?)?/i);
  if (dateLike) patch.dateTime = dateLike[0];

  const addressLike = message.match(/\b(?:address|adress|at|på|i|in)\s+([^,.!?]{3,80})/i);
  if (addressLike && !/stockholm|gothenburg|malmö|södertälje/i.test(addressLike[1])) {
    patch.address = addressLike[1].trim();
  } else {
    const city = message.match(/\b(stockholm|gothenburg|göteborg|malmö|södertälje|uppsala|västerås)\b/i);
    if (city) patch.address = city[0];
  }

  return cleanBookingPatch(patch);
}

function buildLocalizedCopy(lang, key, vars = {}) {
  const copy = {
    en: {
      default: 'I can help with pricing, availability, or completing your booking draft.',
      price: 'The estimate updates from property size, extras, and frequency. Complete the draft to get a cleaner estimate.',
      bookingMissing: 'Booking flow is active. Next missing field: {field}.',
      bookingReady: 'Booking draft looks complete. Submit it when you are ready so a coordinator can confirm.',
      support: 'I can help change or cancel a draft. A coordinator should confirm any real booking changes before charging.'
    },
    sv: {
      default: 'Jag kan hjälpa till med pris, tillgänglighet eller att färdigställa bokningsutkastet.',
      price: 'Prisuppskattningen uppdateras utifrån storlek, tillval och frekvens. Fyll i utkastet för en bättre uppskattning.',
      bookingMissing: 'Bokningsflödet är aktivt. Nästa sak som saknas: {field}.',
      bookingReady: 'Bokningsutkastet ser komplett ut. Skicka det när du är redo så att en koordinator kan bekräfta.',
      support: 'Jag kan hjälpa till att ändra eller avboka ett utkast. En koordinator bör bekräfta riktiga ändringar innan debitering.'
    },
    de: {
      default: 'Ich kann bei Preisen, Verfügbarkeit oder deinem Buchungsentwurf helfen.',
      price: 'Die Schätzung aktualisiert sich nach Objektgröße, Extras und Häufigkeit. Vervollständige den Entwurf für eine bessere Schätzung.',
      bookingMissing: 'Der Buchungsprozess ist aktiv. Nächstes fehlendes Feld: {field}.',
      bookingReady: 'Der Buchungsentwurf sieht vollständig aus. Sende ihn ab, damit ein Koordinator bestätigen kann.',
      support: 'Ich kann beim Ändern oder Stornieren eines Entwurfs helfen. Reale Änderungen sollten vor einer Zahlung bestätigt werden.'
    },
    es: {
      default: 'Puedo ayudarte con precios, disponibilidad o completar tu borrador de reserva.',
      price: 'La estimación se actualiza según tamaño, extras y frecuencia. Completa el borrador para una mejor estimación.',
      bookingMissing: 'El flujo de reserva está activo. Falta este dato: {field}.',
      bookingReady: 'El borrador de reserva parece completo. Envíalo cuando estés listo para que un coordinador lo confirme.',
      support: 'Puedo ayudar a cambiar o cancelar un borrador. Un coordinador debe confirmar cambios reales antes de cobrar.'
    }
  };
  const template = copy[lang]?.[key] || copy.en[key] || copy.en.default;
  return template.replace(/\{(\w+)\}/g, (_, name) => vars[name] || '');
}

function buildFallbackResponse(message, lang, context = {}) {
  const lower = message.toLowerCase();
  const inferredPatch = inferSimplePatch(message);
  const missingFields = computeMissingFields(context, inferredPatch);

  let assistantMessage = buildLocalizedCopy(lang, 'default');
  let nav = null;
  let quickActions = [
    { text: lang === 'sv' ? 'Starta bokning' : 'Start booking', val: 'book' },
    { text: lang === 'sv' ? 'Prisuppskattning' : 'Price estimate', val: 'price' }
  ];

  if (/price|pricing|cost|estimate|pris|kostnad|angebot|precio|coste/i.test(lower)) {
    nav = 'pricing';
    assistantMessage = buildLocalizedCopy(lang, 'price');
  } else if (/book|booking|schedule|submitted|boka|städa|termin|reserva/i.test(lower)) {
    nav = 'booking';
    assistantMessage = missingFields.length
      ? buildLocalizedCopy(lang, 'bookingMissing', { field: missingFields[0] })
      : buildLocalizedCopy(lang, 'bookingReady');
  } else if (/cancel|reschedule|change|avboka|ändra|stornieren|cancelar|cambiar/i.test(lower)) {
    nav = 'support';
    assistantMessage = buildLocalizedCopy(lang, 'support');
    quickActions = [
      { text: lang === 'sv' ? 'Ändra tid' : 'Change time', val: 'reschedule' },
      { text: lang === 'sv' ? 'Avboka utkast' : 'Cancel draft', val: 'cancel' }
    ];
  } else if (Object.keys(inferredPatch).length) {
    nav = 'booking';
    assistantMessage = missingFields.length
      ? buildLocalizedCopy(lang, 'bookingMissing', { field: missingFields[0] })
      : buildLocalizedCopy(lang, 'bookingReady');
  }

  return {
    assistantMessage,
    bookingPatch: inferredPatch,
    missingFields,
    quickActions,
    nav,
    mode: 'deterministic-fallback'
  };
}

function safeJsonParse(text) {
  try {
    return JSON.parse(text);
  } catch (_) {
    const match = String(text || '').match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch (_) {
      return null;
    }
  }
}

function normalizeAiPayload(payload, context = {}) {
  if (!payload || typeof payload !== 'object') return null;
  const bookingPatch = cleanBookingPatch(payload.bookingPatch);
  return {
    assistantMessage: asText(payload.assistantMessage || payload.message || payload.reply, 1200),
    bookingPatch,
    missingFields: Array.isArray(payload.missingFields)
      ? payload.missingFields.map((x) => asText(x, 80)).filter((x) => REQUIRED_BOOKING_FIELDS.includes(x)).slice(0, 10)
      : computeMissingFields(context, bookingPatch),
    quickActions: Array.isArray(payload.quickActions)
      ? payload.quickActions.slice(0, 6).map((item) => ({
          text: asText(item?.text || item?.label || item?.val, 80),
          val: asText(item?.val || item?.value || item?.text, 80)
        })).filter((item) => item.text && item.val)
      : [],
    nav: payload.nav && NAV_VALUES.has(payload.nav) ? payload.nav : null,
    mode: 'openai'
  };
}

function buildOpenAIBody({ message, lang, context }) {
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  const system = [
    'You are CleanAI booking assistant for a cleaning service marketplace.',
    'Extract booking details and ask for the next missing detail.',
    'Never invent confirmed bookings, payments, provider approval, or final prices.',
    'Always say that a coordinator must confirm real bookings before charging.',
    'Keep replies short, practical, and in the user language when possible.',
    'Only use bookingPatch fields that are explicitly present or strongly implied by the user.'
  ].join(' ');

  return {
    model,
    temperature: 0.2,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'cleanai_booking_assistant_response',
        strict: true,
        schema: RESPONSE_SCHEMA
      }
    },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify({ message, lang, context }) }
    ]
  };
}

async function callOpenAI(input) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(buildOpenAIBody(input))
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed: ${response.status} ${text.slice(0, 240)}`);
  }

  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content || '';
  const parsed = safeJsonParse(content);
  return normalizeAiPayload(parsed, input.context);
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { assistantMessage: 'Method not allowed' });
  if (isRateLimited(req)) return send(res, 429, { assistantMessage: 'Too many requests. Try again shortly.' });

  const input = collectInput(req.body);
  if (!input.message) return send(res, 400, { assistantMessage: 'Invalid request' });

  try {
    const aiPayload = await callOpenAI(input);
    if (aiPayload?.assistantMessage) {
      return send(res, 200, aiPayload);
    }
  } catch (error) {
    console.warn('AI provider unavailable; using fallback', error?.message || error);
  }

  return send(res, 200, buildFallbackResponse(input.message, input.lang, input.context));
};

module.exports.__internal = {
  RESPONSE_SCHEMA,
  buildFallbackResponse,
  buildOpenAIBody,
  cleanBookingPatch,
  computeMissingFields,
  normalizeAiPayload
};
