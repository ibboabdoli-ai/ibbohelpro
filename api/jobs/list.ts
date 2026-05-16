const DEMO_JOBS = [
  {
    id: 'job-home-weekly-stockholm',
    title: 'Weekly home clean',
    location: 'Stockholm · Södermalm',
    budget: '€120',
    start: 'Tue · 09:00',
    category: 'home',
    description: 'Recurring apartment cleaning. Customer requested kitchen focus and eco products.'
  },
  {
    id: 'job-office-evening-solna',
    title: 'Office evening refresh',
    location: 'Solna Business Park',
    budget: '€220',
    start: 'Wed · 18:00',
    category: 'office',
    description: 'Small office after-hours cleaning with desks, floors, and kitchenette.'
  },
  {
    id: 'job-hotel-turnover-arlanda',
    title: 'Hotel turnover support',
    location: 'Arlanda area',
    budget: '€180',
    start: 'Fri · 14:00',
    category: 'hotel',
    description: 'Turnover support for short-stay units. Fast checklist and photo handoff required.'
  }
];

function setHeaders(res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function send(res, status, body) {
  setHeaders(res);
  return res.status(status).json(body);
}

function asText(value, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeJob(row) {
  return {
    id: asText(row.job_id || row.id, 120),
    title: asText(row.title, 160),
    location: asText(row.location, 160),
    budget: asText(row.budget, 80),
    start: asText(row.start_time || row.start, 120),
    category: asText(row.category, 80),
    description: asText(row.description, 500)
  };
}

async function fetchSupabaseJobs() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;

  const endpoint = `${url.replace(/\/$/, '')}/rest/v1/jobs?status=eq.open&select=job_id,title,location,budget,start_time,category,description&order=created_at.desc&limit=25`;
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json'
    }
  });
  if (!response.ok) throw new Error(await response.text().catch(() => 'Supabase jobs fetch failed'));
  const rows = await response.json().catch(() => []);
  return Array.isArray(rows) ? rows.map(normalizeJob).filter((job) => job.id && job.title) : [];
}

module.exports = async function handler(req, res) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (!['GET', 'POST'].includes(req.method)) return send(res, 405, { error: 'Method not allowed' });

  try {
    const jobs = await fetchSupabaseJobs();
    return send(res, 200, {
      jobs: jobs && jobs.length ? jobs : DEMO_JOBS,
      mode: jobs ? 'supabase' : 'demo-api'
    });
  } catch (error) {
    return send(res, 502, { error: error.message || 'Job list failed', jobs: DEMO_JOBS, mode: 'fallback-demo-jobs' });
  }
};

module.exports.__internal = { DEMO_JOBS, normalizeJob };
