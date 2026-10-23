import { useEffect, useState } from 'react';
import { supportedLanguages, translations } from '../i18n/language.js';

export function useLanguage() {
  const [lang, setLang] = useState(() => {
    const urlLang = new URLSearchParams(window.location.search).get('lang');
    const savedLang = window.localStorage.getItem('zghauto-lang');
    return supportedLanguages.includes(urlLang) ? urlLang : supportedLanguages.includes(savedLang) ? savedLang : 'ru';
  });

  const updateLang = (nextLang) => {
    if (!supportedLanguages.includes(nextLang)) return;
    setLang(nextLang);
    window.localStorage.setItem('zghauto-lang', nextLang);
    document.documentElement.lang = nextLang === 'zh' ? 'zh-CN' : nextLang;
    const url = new URL(window.location.href);
    url.searchParams.set('lang', nextLang);
    window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
  };

  useEffect(() => {
    document.documentElement.lang = lang === 'zh' ? 'zh-CN' : lang;
  }, [lang]);

  return { lang, setLang: updateLang, t: translations[lang] || translations.ru };
}
