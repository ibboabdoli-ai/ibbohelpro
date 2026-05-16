function setHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
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

async function patchSupabase(applicationId, status) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/provider_applications?application_id=eq.${encodeURIComponent(applicationId)}`, {
    method: 'PATCH',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify({ status, reviewed_at: new Date().toISOString() })
  });
  if (!response.ok) throw new Error(await response.text().catch(() => 'Supabase update failed'));
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const auth = requireAdmin(req);
  if (!auth.ok) return send(res, auth.error.includes('configured') ? 503 : 401, { error: auth.error });

  const applicationId = asText(req.body?.applicationId, 120);
  const status = asText(req.body?.status, 40);
  if (!applicationId || !['approved', 'rejected', 'pending'].includes(status)) {
    return send(res, 400, { error: 'Invalid applicationId or status.' });
  }

  try {
    const updated = await patchSupabase(applicationId, status);
    return send(res, 200, {
      applicationId,
      status: updated?.status || status,
      mode: updated ? 'supabase' : 'admin-api-no-db'
    });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Provider approval failed' });
  }
};
