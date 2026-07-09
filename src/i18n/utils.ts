import { ui, defaultLang } from './ui';

export function getLangFromUrl(url: URL) {
  const [, lang] = url.pathname.split('/');
  if (lang in ui) return lang as keyof typeof ui;
  return defaultLang;
}

export function useTranslations(lang: keyof typeof ui = defaultLang) {
  return function t(key: keyof typeof ui[typeof defaultLang]) {
    return ui[lang][key] || ui[defaultLang][key];
  }
}

export function getLocalizedPathname(url: URL, targetLang: string) {
  const pathname = url.pathname;
  if (targetLang === 'en') {
    return pathname.startsWith('/en') ? pathname : `/en${pathname}`;
  } else {
    return pathname.startsWith('/en') ? pathname.replace('/en', '') || '/' : pathname;
  }
}
