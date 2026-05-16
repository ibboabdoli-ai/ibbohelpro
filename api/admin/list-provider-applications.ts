function setHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

function send(res, status, body) {
  setHeaders(res);
  return res.status(status).json(body);
}

function asText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function requireAdmin(req) {
  const expected = process.env.ADMIN_API_TOKEN;
  if (!expected) return { ok: false, error: 'ADMIN_API_TOKEN is not configured.' };
  const token = asText(req.headers.authorization, 400).replace(/^Bearer\s+/i, '');
  return token === expected ? { ok: true } : { ok: false, error: 'Unauthorized.' };
}

function normalize(row) {
  return {
    applicationId: asText(row.application_id, 120),
    status: asText(row.status, 40),
    providerEmail: asText(row.provider_email, 180),
    providerName: asText(row.provider_name, 180),
    providerType: asText(row.provider_type, 80),
    serviceArea: asText(row.service_area, 240),
    categories: Array.isArray(row.categories) ? row.categories : [],
    weekdays: asText(row.weekdays, 160),
    weekends: asText(row.weekends, 160),
    hourlyRate: asText(row.hourly_rate, 40),
    calloutFee: asText(row.callout_fee, 40),
    verificationFile: asText(row.verification_file, 240),
    bio: asText(row.bio, 1200),
    languages: asText(row.languages, 240),
    portfolio: asText(row.portfolio, 300),
    submittedAt: row.created_at || '',
    reviewedAt: row.reviewed_at || ''
  };
}

async function fetchSupabaseApplications() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/provider_applications?select=*&order=created_at.desc&limit=100`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) throw new Error(await response.text().catch(() => 'Supabase applications fetch failed'));
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows.map(normalize) : [];
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'Method not allowed' });

  const auth = requireAdmin(req);
  if (!auth.ok) return send(res, auth.error.includes('configured') ? 503 : 401, { error: auth.error });

  try {
    const applications = await fetchSupabaseApplications();
    return send(res, 200, {
      applications: applications || [],
      mode: applications ? 'supabase' : 'admin-api-no-db'
    });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Provider application list failed' });
  }
};
