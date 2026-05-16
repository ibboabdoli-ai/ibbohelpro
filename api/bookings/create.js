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

function asText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function buildReference(prefix = 'CLN') {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function cleanDraft(draft = {}) {
  return {
    category: asText(draft.category, 80),
    address: asText(draft.address, 240),
    propertySize: asText(draft.propertySize, 120),
    frequency: asText(draft.frequency, 120),
    dateTime: asText(draft.dateTime, 120),
    extras: Array.isArray(draft.extras) ? draft.extras.map((x) => asText(x, 80)).filter(Boolean).slice(0, 12) : [],
    notes: asText(draft.notes, 1000),
    locationConsent: Boolean(draft.locationConsent)
  };
}

async function insertSupabase(record) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/bookings`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(record)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Supabase insert failed: ${response.status} ${text}`);
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const body = req.body || {};
  const draft = cleanDraft(body.draft);
  if (!draft.category || !draft.address) {
    return send(res, 400, { error: 'Missing required booking fields: category and address.' });
  }

  const now = new Date().toISOString();
  const bookingId = buildReference('CLN');
  const record = {
    booking_id: bookingId,
    status: 'submitted',
    customer_email: asText(body.user?.email, 180),
    customer_name: asText(body.user?.name, 180),
    profile_role: asText(body.profile?.role, 80),
    category: draft.category,
    address: draft.address,
    property_size: draft.propertySize,
    frequency: draft.frequency,
    date_time: draft.dateTime,
    extras: draft.extras,
    notes: draft.notes,
    location_consent: draft.locationConsent,
    estimate: body.estimate || null,
    created_at: body.submittedAt || now
  };

  try {
    const inserted = await insertSupabase(record);
    return send(res, 200, {
      bookingId: inserted?.booking_id || bookingId,
      status: inserted?.status || 'submitted',
      submittedAt: inserted?.created_at || record.created_at,
      mode: inserted ? 'supabase' : 'demo-api'
    });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Booking persistence failed' });
  }
};
