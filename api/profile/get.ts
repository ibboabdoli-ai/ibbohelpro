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

function userId(user = {}) {
  const explicit = asText(user.id || user.userId || user.sub, 180);
  if (explicit) return explicit;
  const email = normalizeEmail(user.email);
  return email ? `demo:${email}` : '';
}

function toPublicProfile(row, fallbackUser) {
  return {
    userId: row?.user_id || userId(fallbackUser),
    authProvider: row?.auth_provider || 'demo',
    email: row?.email || normalizeEmail(fallbackUser?.email),
    name: row?.full_name || asText(fallbackUser?.name, 180),
    role: row?.role || fallbackUser?.role || 'customer',
    preferredCategory: row?.preferred_category || '',
    providerStatus: row?.provider_status || '',
    onboardingComplete: Boolean(row?.onboarding_complete),
    updatedAt: row?.updated_at || null
  };
}

async function readSupabase(profileUserId) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/user_profiles?user_id=eq.${encodeURIComponent(profileUserId)}&select=*&limit=1`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Supabase profile read failed: ${response.status} ${text}`);
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] || null : rows;
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const user = req.body?.user || {};
  const id = userId(user);
  if (!id) return send(res, 400, { error: 'Missing required user identity fields.' });

  try {
    const row = await readSupabase(id);
    return send(res, 200, {
      ok: true,
      mode: row ? 'supabase' : 'demo-api',
      profile: toPublicProfile(row, user)
    });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Profile read failed' });
  }
};
