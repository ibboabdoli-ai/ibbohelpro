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

async function insertSupabase(record) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/job_responses`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: JSON.stringify(record)
  });
  if (!response.ok) throw new Error(await response.text().catch(() => 'Supabase insert failed'));
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const response = asText(req.body?.response, 40);
  const jobId = asText(req.body?.jobId, 120);
  if (!jobId || !['accepted', 'declined'].includes(response)) {
    return send(res, 400, { error: 'Invalid job response.' });
  }

  const record = {
    job_id: jobId,
    response,
    provider_email: asText(req.body?.user?.email, 180),
    provider_status: asText(req.body?.profile?.providerStatus, 80),
    responded_at: new Date().toISOString()
  };

  try {
    const inserted = await insertSupabase(record);
    return send(res, 200, { ok: true, mode: inserted ? 'supabase' : 'demo-api', response, jobId });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Job response failed' });
  }
};
