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

function normalizeEmail(value) {
  return asText(value, 180).toLowerCase();
}

function demoUserId(user = {}) {
  const explicit = asText(user.id || user.userId || user.sub, 180);
  if (explicit) return explicit;
  const email = normalizeEmail(user.email);
  return email ? `demo:${email}` : '';
}

function authProvider(user = {}) {
  return asText(user.authProvider || user.provider || 'demo', 80) || 'demo';
}

function buildReference(prefix = 'PRV') {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `${prefix}-${stamp}-${random}`;
}

function cleanProviderData(data = {}) {
  return {
    type: asText(data.type, 80),
    serviceArea: asText(data.serviceArea, 240),
    categories: Array.isArray(data.categories) ? data.categories.map((x) => asText(x, 80)).filter(Boolean).slice(0, 12) : [],
    weekdays: asText(data.weekdays, 160),
    weekends: asText(data.weekends, 160),
    hourlyRate: asText(data.hourlyRate, 40),
    calloutFee: asText(data.calloutFee, 40),
    verificationFile: asText(data.verificationFile, 240),
    bio: asText(data.bio, 1200),
    languages: asText(data.languages, 240),
    portfolio: asText(data.portfolio, 300)
  };
}

async function insertSupabase(record) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/provider_applications`, {
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
  const user = body.user || {};
  const providerData = cleanProviderData(body.providerData);
  if (!providerData.serviceArea || !providerData.hourlyRate) {
    return send(res, 400, { error: 'Missing required provider fields: service area and hourly rate.' });
  }

  const now = new Date().toISOString();
  const applicationId = buildReference('PRV');
  const record = {
    application_id: applicationId,
    status: 'pending',
    provider_user_id: demoUserId(user),
    auth_provider: authProvider(user),
    provider_email: normalizeEmail(user.email),
    provider_name: asText(user.name, 180),
    provider_type: providerData.type,
    service_area: providerData.serviceArea,
    categories: providerData.categories,
    weekdays: providerData.weekdays,
    weekends: providerData.weekends,
    hourly_rate: providerData.hourlyRate,
    callout_fee: providerData.calloutFee,
    verification_file: providerData.verificationFile,
    bio: providerData.bio,
    languages: providerData.languages,
    portfolio: providerData.portfolio,
    created_at: body.submittedAt || now
  };

  try {
    const inserted = await insertSupabase(record);
    return send(res, 200, {
      applicationId: inserted?.application_id || applicationId,
      status: inserted?.status || 'pending',
      submittedAt: inserted?.created_at || record.created_at,
      owner: inserted?.provider_user_id || record.provider_user_id,
      mode: inserted ? 'supabase' : 'demo-api'
    });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Provider application persistence failed' });
  }
};