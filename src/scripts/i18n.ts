const localeFiles = {
  en: new URL('../locales/en.json', import.meta.url).href,
  sv: new URL('../locales/sv.json', import.meta.url).href,
  se: new URL('../locales/se.json', import.meta.url).href, // legacy alias
  de: new URL('../locales/de.json', import.meta.url).href,
  es: new URL('../locales/es.json', import.meta.url).href
};

const languageMeta = {
  en: { label: 'English', locale: 'en-US' },
  sv: { label: 'Svenska', locale: 'sv-SE' },
  de: { label: 'Deutsch', locale: 'de-DE' },
  es: { label: 'Español', locale: 'es-ES' }
};

const languageKey = 'lang';
let translations = {};
let fallbackTranslations = {};
let currentLanguage = 'en';
const listeners = new Set();
let selectorEl = null;
let lastFocused = null;

async function loadLocale(lang) {
  const path = localeFiles[lang] || localeFiles.en;
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error('Failed to load locale');
    return await res.json();
  } catch (error) {
    console.warn('Locale load error', error);
    return {};
  }
}

function t(key, fallback = '') {
  if (Object.prototype.hasOwnProperty.call(translations, key)) return translations[key];
  if (Object.prototype.hasOwnProperty.call(fallbackTranslations, key)) return fallbackTranslations[key];
  if (fallback) return fallback;
  return key;
}

function formatWithLocale(date, lang = currentLanguage, options = {}) {
  const locale = languageMeta[lang]?.locale || languageMeta.en.locale;
  return new Intl.DateTimeFormat(locale, options).format(date);
}

function getStoredLanguage() {
  const stored = localStorage.getItem(languageKey) || localStorage.getItem('cleanai_language');
  return stored === 'se' ? 'sv' : stored;
}

async function setLanguage(lang, persist = true) {
  const normalizedLang = lang === 'se' ? 'sv' : lang;
  const target = localeFiles[normalizedLang] ? normalizedLang : 'en';
  const loaded = await loadLocale(target);
  translations = loaded && Object.keys(loaded).length ? loaded : {};
  currentLanguage = target;
  if (!Object.keys(fallbackTranslations).length || !fallbackTranslations['app.brand']) {
    const english = await loadLocale('en');
    fallbackTranslations = english || {};
  }
  if (!Object.keys(translations).length) {
    translations = fallbackTranslations;
  }
  if (persist) {
    localStorage.setItem(languageKey, target);
    localStorage.setItem('languageSelected', 'true');
  }
  document.documentElement.lang = languageMeta[target]?.locale || 'en';
  applyTranslations();
  listeners.forEach((cb) => cb(target));
  closeSelector();
  document.body.classList.remove('lang-blocked');
}

async function initI18n() {
  const stored = getStoredLanguage();
  if (!stored) {
    document.body.classList.add('lang-blocked');
    openLanguageSelector({ required: true });
    await new Promise((resolve) => {
      const off = onLanguageChange(() => {
        off();
        resolve();
      });
    });
  } else {
    await setLanguage(stored || 'en', Boolean(stored));
  }
  document.body.classList.remove('lang-blocked');
}

function applyTranslations(scope = document) {
  scope.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const fallback = el.dataset.i18nFallback || el.textContent?.trim() || '';
    const html = el.dataset.i18nHtml === 'true';
    const value = t(key, fallback);
    if (html) el.innerHTML = value;
    else el.textContent = value;
  });

  scope.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    const attr = el.dataset.i18nAttr;
    const key = el.dataset.i18nKey || el.dataset.i18n || '';
    const fallback = el.getAttribute(attr) || '';
    const value = t(key, fallback);
    if (attr) el.setAttribute(attr, value);
  });
}

function onLanguageChange(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function buildLanguageOption({ code, label }) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'language-option';
  button.textContent = label;
  button.dataset.lang = code;
  button.addEventListener('click', async () => {
    await setLanguage(code);
    closeSelector();
  });
  return button;
}

function trapFocus(modal) {
  const focusable = modal.querySelectorAll('button');
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  modal.addEventListener('keydown', (event) => {
    if (event.key === 'Tab') {
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
    if (event.key === 'Escape') {
      closeSelector();
    }
  });
  return first;
}

function openLanguageSelector({ required = false } = {}) {
  if (selectorEl) {
    selectorEl.classList.remove('hidden');
    selectorEl.setAttribute('aria-hidden', 'false');
    selectorEl.querySelector('button')?.focus();
    return;
  }
  selectorEl = document.createElement('div');
  selectorEl.className = 'language-backdrop';
  selectorEl.setAttribute('role', 'dialog');
  selectorEl.setAttribute('aria-modal', 'true');
  selectorEl.setAttribute('aria-label', 'Language selector');

  const dialog = document.createElement('div');
  dialog.className = 'language-dialog';

  const title = document.createElement('p');
  title.className = 'language-title';
  title.setAttribute('data-i18n', 'language.title');
  title.textContent = t('language.title', 'Choose your language');

  const subtitle = document.createElement('p');
  subtitle.className = 'language-subtitle';
  subtitle.setAttribute('data-i18n', 'language.subtitle');
  subtitle.textContent = t('language.subtitle', 'Your choice will update the UI and chat replies.');

  const grid = document.createElement('div');
  grid.className = 'language-grid';
  Object.entries(languageMeta).forEach(([code, meta]) => {
    grid.appendChild(buildLanguageOption({ code, label: meta.label }));
  });

  const dismiss = document.createElement('button');
  dismiss.type = 'button';
  dismiss.className = 'language-dismiss';
  dismiss.setAttribute('data-i18n', 'language.dismiss');
  dismiss.textContent = t('language.dismiss', 'Continue with English');
  dismiss.addEventListener('click', () => closeSelector());
  if (required) dismiss.classList.add('hidden');

  dialog.appendChild(title);
  dialog.appendChild(subtitle);
  dialog.appendChild(grid);
  dialog.appendChild(dismiss);
  selectorEl.appendChild(dialog);
  document.body.appendChild(selectorEl);
  applyTranslations(dialog);
  lastFocused = document.activeElement;
  const first = trapFocus(dialog);
  setTimeout(() => first?.focus(), 0);
}

function closeSelector() {
  if (!selectorEl) return;
  selectorEl.classList.add('hidden');
  selectorEl.setAttribute('aria-hidden', 'true');
  if (lastFocused) lastFocused.focus();
  setTimeout(() => {
    selectorEl?.remove();
    selectorEl = null;
  }, 50);
}

function getCurrentLanguage() {
  return currentLanguage;
}

export {
  initI18n,
  applyTranslations,
  t,
  onLanguageChange,
  setLanguage,
  openLanguageSelector,
  getCurrentLanguage,
  formatWithLocale,
  languageMeta
};
