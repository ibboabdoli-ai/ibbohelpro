const accountHydrationKeys = {
  user: 'cleanai_user',
  profile: 'cleanai_profile',
  bookings: 'cleanai_bookings',
  providerApplications: 'cleanai_provider_applications',
  submittedBookingId: 'cleanai_submitted_booking_id'
};

type StoredUser = {
  id?: string;
  userId?: string;
  sub?: string;
  email?: string;
  name?: string;
  role?: string;
};

type AccountSnapshot = {
  profile?: Record<string, unknown>;
  bookings?: Array<Record<string, unknown>>;
  providerApplication?: Record<string, unknown> | null;
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Unable to read local account state', key, error);
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
  const localProfile = readJSON<Record<string, unknown>>(accountHydrationKeys.profile, {});
  saveJSON(accountHydrationKeys.profile, { ...localProfile, ...serverProfile, hydratedAt: new Date().toISOString() });
}

function mergeBookings(bookings: Array<Record<string, unknown>>) {
  if (!Array.isArray(bookings)) return;
  const local = readJSON<Array<Record<string, unknown>>>(accountHydrationKeys.bookings, []);
  const byId = new Map<string, Record<string, unknown>>();
  [...bookings, ...local].forEach((booking) => {
    const id = String(booking.bookingId || booking.booking_id || '').trim();
    if (id && !byId.has(id)) byId.set(id, booking);
  });
  const merged = Array.from(byId.values()).slice(0, 20);
  saveJSON(accountHydrationKeys.bookings, merged);
  if (merged[0]?.bookingId && !localStorage.getItem(accountHydrationKeys.submittedBookingId)) {
    localStorage.setItem(accountHydrationKeys.submittedBookingId, String(merged[0].bookingId));
  }
}

function mergeProviderApplication(application: Record<string, unknown> | null | undefined) {
  if (!application) return;
  const local = readJSON<Array<Record<string, unknown>>>(accountHydrationKeys.providerApplications, []);
  const applicationId = String(application.applicationId || application.application_id || '').trim();
  const filtered = applicationId ? local.filter((item) => String(item.applicationId || item.application_id || '') !== applicationId) : local;
  saveJSON(accountHydrationKeys.providerApplications, [application, ...filtered].slice(0, 20));
  mergeProfile({
    providerStatus: application.status,
    providerApplicationId: applicationId
  });
}

function mergeSnapshot(snapshot: AccountSnapshot) {
  if (snapshot.profile) mergeProfile(snapshot.profile);
  if (snapshot.bookings) mergeBookings(snapshot.bookings);
  mergeProviderApplication(snapshot.providerApplication);
}

async function hydrateAccountSnapshot() {
  const user = readJSON<StoredUser | null>(accountHydrationKeys.user, null);
  if (!hasUsableIdentity(user)) return;

  try {
    const response = await fetch('/api/account/snapshot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user })
    });
    if (!response.ok) throw new Error(`Account snapshot hydration failed: ${response.status}`);
    const payload = await response.json().catch(() => null);
    if (payload?.ok) mergeSnapshot(payload);
  } catch (error) {
    console.warn('Account snapshot hydration skipped; local state remains active.', error);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', hydrateAccountSnapshot, { once: true });
} else {
  hydrateAccountSnapshot();
}

export { hydrateAccountSnapshot };
