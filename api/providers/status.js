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

async function fetchSupabaseStatus(applicationId, providerEmail) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const params = applicationId
    ? `application_id=eq.${encodeURIComponent(applicationId)}`
    : `provider_email=eq.${encodeURIComponent(providerEmail)}`;
  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/provider_applications?${params}&select=application_id,status,reviewed_at,created_at&order=created_at.desc&limit=1`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) throw new Error(await response.text().catch(() => 'Supabase status fetch failed'));
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] : null;
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const applicationId = asText(req.body?.applicationId, 120);
  const providerEmail = asText(req.body?.providerEmail || req.body?.user?.email, 180);
  if (!applicationId && !providerEmail) {
    return send(res, 400, { error: 'Provide applicationId or providerEmail.' });
  }

  try {
    const row = await fetchSupabaseStatus(applicationId, providerEmail);
    if (!row) {
      return send(res, 200, {
        applicationId,
        status: 'pending',
        mode: 'demo-api-no-db',
        message: 'No remote provider status available. Keeping local pending status.'
      });
    }
    return send(res, 200, {
      applicationId: row.application_id,
      status: row.status,
      reviewedAt: row.reviewed_at,
      submittedAt: row.created_at,
      mode: 'supabase'
    });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Provider status check failed' });
  }
};
