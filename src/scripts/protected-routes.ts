type StoredUser = {
  email?: string;
  name?: string;
  role?: string;
};

const protectedPaths = new Set([
  '/onboarding.html',
  '/book.html',
  '/provider-onboarding.html',
  '/provider-feed.html'
]);

const adminPaths = new Set([
  '/admin.html'
]);

function readUser(): StoredUser | null {
  try {
    const raw = localStorage.getItem('cleanai_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function hasValidDemoSession(user: StoredUser | null) {
  const email = String(user?.email || '').trim();
  return Boolean(email && email.includes('@'));
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
  const isLoggedIn = hasValidDemoSession(user);
  if (!isLoggedIn) {
    redirectToLogin('login_required');
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
