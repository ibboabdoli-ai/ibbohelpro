const scopedStorageKeys = new Set([
  'cleanai_profile',
  'cleanai_booking_draft',
  'cleanai_bookings',
  'cleanai_provider_applications',
  'cleanai_job_responses'
]);

const originalGetItem = Storage.prototype.getItem;
const originalSetItem = Storage.prototype.setItem;
const originalRemoveItem = Storage.prototype.removeItem;
const originalClear = Storage.prototype.clear;

function safeParseUser(raw: string | null): { email?: string } | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function currentUserScope(storage: Storage) {
  const raw = originalGetItem.call(storage, 'cleanai_user');
  const user = safeParseUser(raw);
  const email = String(user?.email || '').trim().toLowerCase();
  if (!email || !email.includes('@')) return '';
  return email.replace(/[^a-z0-9._@-]/g, '_');
}

function scopedKey(storage: Storage, key: string) {
  if (!scopedStorageKeys.has(key)) return key;
  const scope = currentUserScope(storage);
  return scope ? `cleanai:user:${scope}:${key}` : key;
}

function installSessionStorageScope() {
  if ((window as any).__cleanaiSessionScopeInstalled) return;
  (window as any).__cleanaiSessionScopeInstalled = true;

  Storage.prototype.getItem = function getScopedItem(key: string) {
    const nextKey = scopedKey(this, key);
    return originalGetItem.call(this, nextKey);
  };

  Storage.prototype.setItem = function setScopedItem(key: string, value: string) {
    const nextKey = scopedKey(this, key);
    return originalSetItem.call(this, nextKey, value);
  };

  Storage.prototype.removeItem = function removeScopedItem(key: string) {
    const nextKey = scopedKey(this, key);
    return originalRemoveItem.call(this, nextKey);
  };

  Storage.prototype.clear = function clearScopedStorage() {
    return originalClear.call(this);
  };
}

installSessionStorageScope();

export { installSessionStorageScope };
