const profileHydrationKeys = {
  user: 'cleanai_user',
  profile: 'cleanai_profile'
};

type StoredUser = {
  id?: string;
  userId?: string;
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Unable to read local profile state', key, error);
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function hasUsableIdentity(user: StoredUser | null) {
  if (!user) return false;
  if (String(user.id || user.userId || user.sub || '').trim()) return true;
  return String(user.email || '').includes('@');
}

function mergeProfile(serverProfile: Record<string, unknown>) {
  const localProfile = readJSON<Record<string, unknown>>(profileHydrationKeys.profile, {});
  saveJSON(profileHydrationKeys.profile, { ...localProfile, ...serverProfile, hydratedAt: new Date().toISOString() });
}

async function hydrateProfileFromServer() {
  const user = readJSON<StoredUser | null>(profileHydrationKeys.user, null);
  if (!hasUsableIdentity(user)) return;

  try {
    const response = await fetch('/api/profile/get', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    });
    if (!response.ok) throw new Error(`Profile hydration failed: ${response.status}`);
    const payload = await response.json().catch(() => null);
    if (payload?.profile) mergeProfile(payload.profile);
  } catch (error) {
    console.warn('Profile hydration skipped; local state remains active.', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateProfileFromServer, { once: true });
} else {
  hydrateProfileFromServer();
}

export { hydrateProfileFromServer };
