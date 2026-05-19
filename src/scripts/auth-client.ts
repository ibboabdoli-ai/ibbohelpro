type AuthUser = {
  id?: string;
  userId?: string;
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
  authProvider?: string;
};

type SupabaseAuthResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  user?: {
    id?: string;
    email?: string;
    user_metadata?: Record<string, unknown>;
  };
};

const authStorageKeys = {
  user: 'cleanai_user',
  auth: 'cleanai_auth_token',
  profile: 'cleanai_profile'
};

function envValue(key: string) {
  return String((import.meta as any).env?.[key] || '').trim();
}

function supabaseAuthConfig() {
  const url = envValue('VITE_SUPABASE_URL') || envValue('NEXT_PUBLIC_SUPABASE_URL');
  const anonKey = envValue('VITE_SUPABASE_ANON_KEY') || envValue('NEXT_PUBLIC_SUPABASE_ANON_KEY') || envValue('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
  if (!url || !anonKey) return null;
  return { url: url.replace(/\/$/, ''), anonKey };
}

function isSupabaseAuthEnabled() {
  return Boolean(supabaseAuthConfig());
}

function sanitizeText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function sessionExpiry(expiresInSeconds?: number) {
  const seconds = Number.isFinite(expiresInSeconds) && expiresInSeconds ? Number(expiresInSeconds) : 24 * 60 * 60;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

function mapAuthUser(data: SupabaseAuthResponse, fallback: { email: string; name?: string; role?: string }): AuthUser {
  const metadata = data.user?.user_metadata || {};
  const email = sanitizeText(data.user?.email || fallback.email, 180).toLowerCase();
  const role = sanitizeText(metadata.role || fallback.role || 'customer', 40) || 'customer';
  const name = sanitizeText(metadata.name || fallback.name || email.split('@')[0], 180);
  return {
    id: sanitizeText(data.user?.id, 180),
    userId: sanitizeText(data.user?.id, 180),
    sub: sanitizeText(data.user?.id, 180),
    email,
    name,
    role,
    authProvider: 'supabase'
  };
}

function persistAuth(data: SupabaseAuthResponse, fallback: { email: string; name?: string; role?: string }) {
  const user = mapAuthUser(data, fallback);
  saveJSON(authStorageKeys.user, user);
  saveJSON(authStorageKeys.auth, {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    issuedAt: new Date().toISOString(),
    expiresAt: sessionExpiry(data.expires_in),
    role: user.role,
    authProvider: 'supabase'
  });
  const profile = readJSON<Record<string, unknown>>(authStorageKeys.profile, {});
  saveJSON(authStorageKeys.profile, { ...profile, role: user.role, authProvider: 'supabase' });
  return user;
}

async function supabaseAuthRequest(path: string, body: Record<string, unknown>) {
  const config = supabaseAuthConfig();
  if (!config) throw new Error('Supabase Auth is not configured.');

  const response = await fetch(`${config.url}/auth/v1/${path}`, {
    method: 'POST',
    headers: {
      apikey: config.anonKey,
      Authorization: `Bearer ${config.anonKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = payload?.msg || payload?.message || payload?.error_description || payload?.error || `Auth request failed: ${response.status}`;
    throw new Error(message);
  }
  return payload as SupabaseAuthResponse;
}

async function signInWithPassword(email: string, password: string) {
  const payload = await supabaseAuthRequest('token?grant_type=password', { email, password });
  return persistAuth(payload, { email });
}

async function signUpWithPassword(input: { email: string; password: string; name: string; role: string }) {
  const payload = await supabaseAuthRequest('signup', {
    email: input.email,
    password: input.password,
    data: { name: input.name, role: input.role }
  });

  if (!payload.access_token) {
    throw new Error('Registration created. Check your email to confirm the account, then log in.');
  }

  return persistAuth(payload, input);
}

function setError(id: string, message: string) {
  const node = document.getElementById(id);
  if (node) node.textContent = message;
}

function go(path: string) {
  window.location.href = path;
}

function bindSupabaseLogin() {
  document.getElementById('login-form')?.addEventListener('submit', async (event) => {
    if (!isSupabaseAuthEnabled()) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const email = sanitizeText(data.get('email'), 180).toLowerCase();
    const password = sanitizeText(data.get('password'), 200);
    if (!email.includes('@') || password.length < 8) {
      setError('login-error', 'Enter a valid email and password.');
      return;
    }

    try {
      const user = await signInWithPassword(email, password);
      go(user.role === 'provider' ? '/provider-feed.html' : '/onboarding.html');
    } catch (error) {
      setError('login-error', error instanceof Error ? error.message : 'Login failed.');
    }
  });
}

function bindSupabaseRegister() {
  document.getElementById('register-form')?.addEventListener('submit', async (event) => {
    if (!isSupabaseAuthEnabled()) return;
    event.preventDefault();
    event.stopImmediatePropagation();

    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const name = sanitizeText(data.get('name'), 180);
    const email = sanitizeText(data.get('email'), 180).toLowerCase();
    const password = sanitizeText(data.get('password'), 200);
    const role = sanitizeText(data.get('role'), 40) || 'customer';
    if (!name || !email.includes('@') || password.length < 8) {
      setError('register-error', 'Add your name, valid email, and a password with at least 8 characters.');
      return;
    }

    try {
      const user = await signUpWithPassword({ name, email, password, role });
      saveJSON(authStorageKeys.profile, { role, onboardingComplete: false, authProvider: 'supabase' });
      go(user.role === 'provider' ? '/provider-onboarding.html' : '/onboarding.html');
    } catch (error) {
      setError('register-error', error instanceof Error ? error.message : 'Registration failed.');
    }
  });
}

function initSupabaseAuthClient() {
  bindSupabaseLogin();
  bindSupabaseRegister();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSupabaseAuthClient, { once: true });
} else {
  initSupabaseAuthClient();
}

export { initSupabaseAuthClient, isSupabaseAuthEnabled };
