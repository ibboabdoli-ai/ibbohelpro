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

function supabaseConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return { baseUrl: url.replace(/\/$/, ''), key };
}

async function supabaseGet(path) {
  const config = supabaseConfig();
  if (!config) return null;
  const response = await fetch(`${config.baseUrl}/rest/v1/${path}`, {
    method: 'GET',
    headers: {
      apikey: config.key,
      Authorization: `Bearer ${config.key}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Supabase read failed: ${response.status} ${text}`);
  }
  return response.json().catch(() => null);
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
    providerApplicationId: row?.metadata?.providerApplicationId || row?.provider_application_id || '',
    onboardingComplete: Boolean(row?.onboarding_complete),
    updatedAt: row?.updated_at || null
  };
}

function toPublicBooking(row) {
  return {
    bookingId: row.booking_id,
    status: row.status,
    category: row.category,
    address: row.address,
    propertySize: row.property_size,
    frequency: row.frequency,
    dateTime: row.date_time,
    extras: Array.isArray(row.extras) ? row.extras : [],
    estimate: row.estimate || null,
    createdAt: row.created_at
  };
}

function toPublicApplication(row) {
  if (!row) return null;
  return {
    applicationId: row.application_id,
    status: row.status,
    providerType: row.provider_type,
    serviceArea: row.service_area,
    categories: Array.isArray(row.categories) ? row.categories : [],
    hourlyRate: row.hourly_rate,
    calloutFee: row.callout_fee,
    reviewedAt: row.reviewed_at,
    createdAt: row.created_at
  };
}

async function readSnapshot(id, user) {
  const encoded = encodeURIComponent(id);
  const profileRows = await supabaseGet(`user_profiles?user_id=eq.${encoded}&select=*&limit=1`);
  const bookingRows = await supabaseGet(`bookings?customer_user_id=eq.${encoded}&select=booking_id,status,category,address,property_size,frequency,date_time,extras,estimate,created_at&order=created_at.desc&limit=20`);
  const applicationRows = await supabaseGet(`provider_applications?provider_user_id=eq.${encoded}&select=application_id,status,provider_type,service_area,categories,hourly_rate,callout_fee,reviewed_at,created_at&order=created_at.desc&limit=1`);

  const profile = Array.isArray(profileRows) ? profileRows[0] || null : profileRows;
  const bookings = Array.isArray(bookingRows) ? bookingRows.map(toPublicBooking) : [];
  const providerApplication = Array.isArray(applicationRows) ? toPublicApplication(applicationRows[0]) : toPublicApplication(applicationRows);

  return {
    profile: toPublicProfile(profile, user),
    bookings,
    providerApplication
  };
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return send(res, 405, { error: 'Method not allowed' });

  const user = req.body?.user || {};
  const id = userId(user);
  if (!id) return send(res, 400, { error: 'Missing required user identity fields.' });

  try {
    if (!supabaseConfig()) {
      return send(res, 200, {
        ok: true,
        mode: 'demo-api',
        profile: toPublicProfile(null, user),
        bookings: [],
        providerApplication: null
      });
    }

    const snapshot = await readSnapshot(id, user);
    return send(res, 200, { ok: true, mode: 'supabase', ...snapshot });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Account snapshot failed' });
  }
};
