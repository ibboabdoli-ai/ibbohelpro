type HealthCheck = {
  key: string;
  configured: boolean;
  required: boolean;
  description: string;
};

function setHeaders(res: any) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', process.env.APP_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-store');
}

function send(res: any, status: number, body: unknown) {
  setHeaders(res);
  return res.status(status).json(body);
}

function hasEnv(key: string) {
  return Boolean(String(process.env[key] || '').trim());
}

function checks(): HealthCheck[] {
  return [
    {
      key: 'OPENAI_API_KEY',
      configured: hasEnv('OPENAI_API_KEY'),
      required: false,
      description: 'Enables AI booking assistant. Without it, deterministic fallback stays active.'
    },
    {
      key: 'OPENAI_MODEL',
      configured: hasEnv('OPENAI_MODEL'),
      required: false,
      description: 'Optional model override for the AI booking assistant.'
    },
    {
      key: 'SUPABASE_URL',
      configured: hasEnv('SUPABASE_URL'),
      required: true,
      description: 'Required for persistent booking, provider, job, and admin data.'
    },
    {
      key: 'SUPABASE_SERVICE_ROLE_KEY',
      configured: hasEnv('SUPABASE_SERVICE_ROLE_KEY'),
      required: true,
      description: 'Server-only key for Supabase REST writes and admin operations.'
    },
    {
      key: 'ADMIN_API_TOKEN',
      configured: hasEnv('ADMIN_API_TOKEN'),
      required: true,
      description: 'Required for admin provider approval endpoints.'
    },
    {
      key: 'APP_ORIGIN',
      configured: hasEnv('APP_ORIGIN'),
      required: false,
      description: 'Optional CORS origin. Use production domain when locked down.'
    },
    {
      key: 'AI_RATE_LIMIT_MAX',
      configured: hasEnv('AI_RATE_LIMIT_MAX'),
      required: false,
      description: 'Optional per-minute AI endpoint limit. Defaults to 30.'
    }
  ];
}

module.exports = async function handler(req: any, res: any) {
  setHeaders(res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return send(res, 405, { ok: false, error: 'Method not allowed' });

  const env = checks();
  const missingRequired = env.filter((item) => item.required && !item.configured).map((item) => item.key);

  return send(res, missingRequired.length ? 503 : 200, {
    ok: missingRequired.length === 0,
    service: 'cleanai-mvp',
    stage: 5,
    timestamp: new Date().toISOString(),
    missingRequired,
    env
  });
};

module.exports.__internal = { checks };
