type StoredUser = {
  email?: string;
  name?: string;
  role?: string;
};

type AuthToken = {
  issuedAt?: string;
  expiresAt?: string;
  role?: string;
};

const userKey = 'cleanai_user';
const authKey = 'cleanai_auth_token';
const protectedPaths = new Set([
  '/onboarding.html',
  '/book.html',
  '/provider-onboarding.html',
  '/provider-feed.html'
]);

const adminPaths = new Set([
  '/admin.html'
]);

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readUser(): StoredUser | null {
  return readJSON<StoredUser | null>(userKey, null);
}

function readAuth(): AuthToken | null {
  return readJSON<AuthToken | null>(authKey, null);
}

function hasValidDemoSession(user: StoredUser | null) {
  const email = String(user?.email || '').trim();
  return Boolean(email && email.includes('@'));
}

function isExpired(auth: AuthToken | null) {
  if (!auth?.expiresAt) return false;
  return Date.now() >= Date.parse(auth.expiresAt);
}

function clearSessionIdentity() {
  localStorage.removeItem(userKey);
  localStorage.removeItem(authKey);
}

function currentPath() {
  const path = window.location.pathname || '/';
  if (path === '/') return '/index.html';
  return path;
}

function redirectToLogin(reason: string) {
  const target = `${window.location.pathname}${window.location.search}${window.location.hash}`;
  const params = new URLSearchParams({ reason, next: target });
  window.location.replace(`/login.html?${params.toString()}`);
}

function guardProtectedRoutes() {
  const path = currentPath();
  if (!protectedPaths.has(path) && !adminPaths.has(path)) return;

  const user = readUser();
  const auth = readAuth();
  const isLoggedIn = hasValidDemoSession(user);
  if (!isLoggedIn) {
    redirectToLogin('login_required');
    return;
  }

  if (isExpired(auth)) {
    clearSessionIdentity();
    redirectToLogin('session_expired');
    return;
  }

  if (path === '/book.html' && user?.role === 'provider') {
    window.location.replace('/provider-feed.html');
    return;
  }

  if ((path === '/provider-onboarding.html' || path === '/provider-feed.html') && user?.role !== 'provider') {
    window.location.replace('/onboarding.html');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', guardProtectedRoutes, { once: true });
} else {
  guardProtectedRoutes();
}

export { guardProtectedRoutes };
