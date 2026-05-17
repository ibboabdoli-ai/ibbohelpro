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

function authProvider(user = {}) {
  return asText(user.authProvider || user.provider || 'demo', 80) || 'demo';
}

function allowedRole(value) {
  const role = asText(value, 40);
  return ['customer', 'provider', 'admin'].includes(role) ? role : 'customer';
}

function cleanProfile(body = {}) {
  const user = body.user || {};
  const profile = body.profile || {};
  const id = userId(user);
  return {
    user_id: id,
    auth_provider: authProvider(user),
    email: normalizeEmail(user.email),
    full_name: asText(user.name || profile.name, 180),
    role: allowedRole(profile.role || user.role),
    preferred_category: asText(profile.preferredCategory || profile.category, 80),
    provider_status: asText(profile.providerStatus, 80),
    onboarding_complete: Boolean(profile.onboardingComplete),
    metadata: {
      source: 'profile-upsert',
      updatedBy: 'client-flow',
      savedAt: new Date().toISOString()
    },
    updated_at: new Date().toISOString()
  };
}

async function upsertSupabase(record) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const response = await fetch(`${url.replace(/\/$/, '')}/rest/v1/user_profiles?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=representation'
    },
    body: JSON.stringify(record)
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Supabase profile upsert failed: ${response.status} ${text}`);
  }

  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows[0] : rows;
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const record = cleanProfile(req.body || {});
  if (!record.user_id || !record.email) {
    return send(res, 400, { error: 'Missing required user identity fields.' });
  }

  try {
    const inserted = await upsertSupabase(record);
    const profile = inserted || record;
    return send(res, 200, {
      ok: true,
      mode: inserted ? 'supabase' : 'demo-api',
      profile: {
        userId: profile.user_id,
        authProvider: profile.auth_provider,
        email: profile.email,
        name: profile.full_name,
        role: profile.role,
        preferredCategory: profile.preferred_category,
        providerStatus: profile.provider_status,
        onboardingComplete: profile.onboarding_complete,
        updatedAt: profile.updated_at
      }
    });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Profile persistence failed' });
  }
};
