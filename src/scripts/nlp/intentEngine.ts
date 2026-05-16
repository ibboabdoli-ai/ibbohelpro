import enCatalog from './intents/en.json';
import seCatalog from './intents/se.json';
import svCatalog from './intents/sv.json';
import deCatalog from './intents/de.json';
import esCatalog from './intents/es.json';

export type SupportedLanguage = 'en' | 'sv' | 'de' | 'es' | 'se';
export type DetectedIntent = {
  intent: string;
  match: string;
  language: SupportedLanguage;
};

type Catalog = Record<string, string>;

const catalogs: Record<SupportedLanguage, Catalog> = {
  en: enCatalog as Catalog,
  se: seCatalog as Catalog,
  sv: svCatalog as Catalog,
  de: deCatalog as Catalog,
  es: esCatalog as Catalog
};

const normalize = (value: string) =>
  value
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();

function evaluateCatalog(message: string, catalog: Catalog, language: SupportedLanguage): DetectedIntent | null {
  const normalizedMessage = normalize(message);

  for (const [phrase, intent] of Object.entries(catalog)) {
    const normalizedPhrase = normalize(phrase);
    if (!normalizedPhrase) continue;

    if (normalizedMessage.includes(normalizedPhrase) || normalizedPhrase.includes(normalizedMessage)) {
      return { intent, match: phrase, language };
    }

    const words = normalizedPhrase.split(/\s+/).filter(Boolean);
    if (words.length && words.every((word) => normalizedMessage.includes(word))) {
      return { intent, match: phrase, language };
    }
  }

  return null;
}

export function detectIntent(message: string, language: SupportedLanguage | string = 'en'): DetectedIntent | null {
  const langKey = (language as string) === 'se' ? 'sv' : language;
  const primary = catalogs[langKey as SupportedLanguage] ? (langKey as SupportedLanguage) : 'en';
  const primaryResult = evaluateCatalog(message, catalogs[primary], primary);
  if (primaryResult) return primaryResult;

  if (primary !== 'en') {
    const fallbackResult = evaluateCatalog(message, catalogs.en, 'en');
    if (fallbackResult) return fallbackResult;
  }

  return null;
}
