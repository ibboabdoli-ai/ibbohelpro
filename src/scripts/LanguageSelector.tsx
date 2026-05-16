import { useEffect, useState } from 'react';
import { setLanguage, getCurrentLanguage } from './i18n.js';

export function LanguageSelector() {
  const [open, setOpen] = useState(!localStorage.getItem('lang'));
  const [lang, setLang] = useState(getCurrentLanguage());

  useEffect(() => {
    if (lang) setLanguage(lang);
    if (localStorage.getItem('lang')) setOpen(false);
  }, [lang]);

  if (!open) return null;

  const choose = (value: string) => {
    localStorage.setItem('lang', value);
    setLang(value as any);
    setOpen(false);
    window.location.href = '/index.html';
  };

  return (
    <div className="language-backdrop" role="dialog" aria-modal="true" aria-label="Language selector">
      <div className="language-dialog">
        <p className="language-title">Choose your language</p>
        <div className="language-grid">
          <button className="language-option" onClick={() => choose('en')}>English</button>
          <button className="language-option" onClick={() => choose('de')}>Deutsch</button>
          <button className="language-option" onClick={() => choose('sv')}>Svenska</button>
          <button className="language-option" onClick={() => choose('es')}>Español</button>
        </div>
      </div>
    </div>
  );
}
