const onboardingStorageKeys = {
  user: 'cleanai_user',
  auth: 'cleanai_auth_token',
  profile: 'cleanai_profile',
  booking: 'cleanai_booking_draft'
};

type CleanAIUser = {
  email?: string;
  name?: string;
  role?: 'customer' | 'provider' | string;
};

function readJSON<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (error) {
    console.warn('Unable to read local state', key, error);
    return fallback;
  }
}

function saveJSON(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value));
}

function safeText(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function selectAll<T extends Element = Element>(selector: string) {
  return Array.from(document.querySelectorAll<T>(selector));
}

function setLabel(id: string, value: string) {
  const node = document.getElementById(id);
  if (node) node.textContent = value;
}

function setOnboardingError(message = '') {
  setLabel('onboarding-error', message);
}

function setActive(buttons: Element[], activeButton: Element | null) {
  buttons.forEach((button) => {
    const isActive = button === activeButton;
    button.classList.toggle('ring-2', isActive);
    button.classList.toggle('ring-emerald-300', isActive);
    button.classList.toggle('border-emerald-300/70', isActive);
    button.classList.toggle('bg-emerald-500/10', isActive);
  });
}

function getUser(): CleanAIUser | null {
  return readJSON<CleanAIUser | null>(onboardingStorageKeys.user, null);
}

function saveUser(update: Partial<CleanAIUser>) {
  const current = getUser() || {};
  const next = { ...current, ...update };
  saveJSON(onboardingStorageKeys.user, next);
  saveJSON(onboardingStorageKeys.auth, { issuedAt: new Date().toISOString(), role: next.role || 'customer' });
  return next;
}

function saveProfile(update: Record<string, unknown>) {
  const current = readJSON<Record<string, unknown>>(onboardingStorageKeys.profile, {});
  const next = { ...current, ...update };
  saveJSON(onboardingStorageKeys.profile, next);
  return next;
}

function saveBooking(update: Record<string, unknown>) {
  const current = readJSON<Record<string, unknown>>(onboardingStorageKeys.booking, {});
  const next = { ...current, ...update };
  saveJSON(onboardingStorageKeys.booking, next);
  return next;
}

function updateTracker(role: string, category: string) {
  setLabel('role-status', role ? 'Captured' : 'Pending');
  setLabel('category-status', role === 'customer' && category ? 'Captured' : 'Pending');
  setLabel('provider-status', role === 'provider' ? 'Ready' : 'Draft');
  setLabel('onboarding-status', role && (role === 'provider' || category) ? 'Ready' : 'Draft');
}

function initOnboardingFlow() {
  if (document.body.dataset.page !== 'onboarding') return;

  const user = getUser();
  if (!user) {
    window.location.href = '/login.html';
    return;
  }

  const userNode = document.getElementById('onboarding-user');
  if (userNode) userNode.textContent = safeText(user.email || user.name || 'Signed in', 120);

  const roleButtons = selectAll<HTMLButtonElement>('[data-role]');
  const categoryButtons = selectAll<HTMLButtonElement>('[data-category]');
  const categorySection = document.getElementById('category-section');
  const continueButton = document.getElementById('continue-onboarding');
  const storedProfile = readJSON<Record<string, any>>(onboardingStorageKeys.profile, {});
  const storedBooking = readJSON<Record<string, any>>(onboardingStorageKeys.booking, {});

  let selectedRole = safeText(user.role || storedProfile.role || 'customer', 40) || 'customer';
  let selectedCategory = safeText(storedBooking.category || storedProfile.preferredCategory || '', 80);

  function render() {
    const activeRole = roleButtons.find((button) => button.dataset.role === selectedRole) || null;
    setActive(roleButtons, activeRole);

    const showCategories = selectedRole === 'customer';
    categorySection?.classList.toggle('hidden', !showCategories);

    const activeCategory = categoryButtons.find((button) => button.dataset.category === selectedCategory) || null;
    setActive(categoryButtons, activeCategory);
    updateTracker(selectedRole, selectedCategory);
  }

  roleButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedRole = safeText(button.dataset.role || 'customer', 40);
      if (selectedRole === 'provider') selectedCategory = '';
      setOnboardingError('');
      render();
    });
  });

  categoryButtons.forEach((button) => {
    button.addEventListener('click', () => {
      selectedCategory = safeText(button.dataset.category || '', 80);
      setOnboardingError('');
      render();
    });
  });

  continueButton?.addEventListener('click', () => {
    if (selectedRole === 'provider') {
      saveUser({ role: 'provider' });
      saveProfile({ role: 'provider', onboardingComplete: false, providerStatus: 'draft' });
      window.location.href = '/provider-onboarding.html';
      return;
    }

    if (!selectedCategory) {
      setOnboardingError('Choose a cleaning category first.');
      return;
    }

    saveUser({ role: 'customer' });
    saveProfile({ role: 'customer', onboardingComplete: true, preferredCategory: selectedCategory });
    saveBooking({ category: selectedCategory });
    window.location.href = '/book.html';
  });

  render();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initOnboardingFlow);
} else {
  initOnboardingFlow();
}
