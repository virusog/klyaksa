// Three languages. Russian is the source: the code and the content are written in
// Russian, and English and Hebrew map each Russian phrase to their own
// (dictionaries in js/lang/<code>/). A phrase without a translation stays Russian,
// and tools/i18n.mjs reports every such phrase.
const KEY = 'klyaksa.v1';

export const LANGS = {
  ru: { name: 'Русский', short: 'RU', dir: 'ltr', speech: 'ru-RU', app: 'Блобика' },
  en: { name: 'English', short: 'EN', dir: 'ltr', speech: 'en-US', app: 'Blobika' },
  he: { name: 'עברית', short: 'עב', dir: 'rtl', speech: 'he-IL', app: 'בלוביקה' },
};

function pickLang() {
  // Node runs the content checks: there the source language is wanted.
  if (typeof window === 'undefined') return 'ru';
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (saved?.lang && LANGS[saved.lang]) return saved.lang;
    // Progress from before languages existed is Russian.
    if (saved) return 'ru';
  } catch { /* private mode */ }
  const asked = (navigator.languages || [navigator.language || '']).map(l => String(l).slice(0, 2).toLowerCase());
  for (const l of asked) {
    if (l === 'he' || l === 'iw') return 'he';
    if (l === 'ru') return 'ru';
    if (l === 'en') return 'en';
  }
  return 'en';
}

export const lang = pickLang();
export const dir = LANGS[lang].dir;
export const appName = LANGS[lang].app;

const dict = lang === 'ru' ? null : (await import(`./lang/${lang}/index.js`)).default;
const missing = new Set();

const fill = (s, p) => s.replace(/\{(\w+)\}/g, (m, k) => (k in p ? String(p[k]) : m));

// Marks a phrase for translation where it is defined; it is translated with t() where it is shown.
export const N = s => s;

// t('Привет, {name}!', { name }) gives the phrase in the current language.
export function t(src, params) {
  if (src == null || src === '') return '';
  let s = String(src);
  if (dict) {
    const v = dict[s];
    if (typeof v === 'string' && v !== '') s = v;
    else if (!missing.has(s)) {
      missing.add(s);
      console.warn(`[i18n] no ${lang} for: ${s}`);
    }
  }
  return params ? fill(s, params) : s;
}

// plural(5, '{n} кадр|{n} кадра|{n} кадров'): three Russian forms; English and Hebrew give two.
export function plural(n, forms, params) {
  const f = t(forms).split('|');
  let i;
  if (lang === 'ru') {
    const a = Math.abs(n) % 100, b = a % 10;
    i = a > 10 && a < 20 ? 2 : b === 1 ? 0 : b >= 2 && b <= 4 ? 1 : 2;
  } else {
    i = n === 1 ? 0 : 1;
  }
  return fill(f[Math.min(i, f.length - 1)], { n, ...params });
}

// Hebrew needs the gender of a word for the verb that follows it; a dictionary
// value may carry it as 'דרקון|m' (who) or 'אוכל|אוכלת' (does: masculine|feminine).
export function gendered(who, does) {
  const [w, g] = t(who).split('|');
  const forms = t(does).split('|');
  return { who: w, does: forms[g === 'f' && forms[1] ? 1 : 0] };
}

export const missingPhrases = () => [...missing];
