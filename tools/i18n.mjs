#!/usr/bin/env node
// Developer tool for the three languages. Russian is the source text.
//
//   node tools/i18n.mjs check            every language: what is missing or broken (exit 1 on errors)
//   node tools/i18n.mjs check he         one language
//   node tools/i18n.mjs todo he play-dots  the phrases of one part still to translate, as JSON
//   node tools/i18n.mjs keys             all phrases grouped by part, as JSON
//   node tools/i18n.mjs raw              Russian literals in code that are not marked with t(), N() or plural()
//                                        (a line with the comment i18n-skip is left alone: text she never sees)
//
// Phrases come from two places:
//  - code: every t('…'), N('…') and plural(n, '…') with a plain string literal;
//  - content: the data modules (lessons, pages, pixel pictures, games' levels and words).
// Each phrase belongs to one part, and each part has its own dictionary file
// js/lang/<lang>/<part>.js, so translators of different parts never touch one file.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const JS = join(ROOT, 'js');
const LANGS = ['en', 'he'];
const CYR = /[А-Яа-яЁё]/;

export const PARTS = ['core', 'school', 'lessons-a', 'lessons-b', 'coloring', 'games', 'pixels', 'words', 'lab',
  'play-pairs', 'play-puzzle', 'play-diff', 'play-dots', 'play-dictation', 'play-oneline', 'play-shades', 'play-patterns', 'play-anim'];

const walk = dir => readdirSync(dir).flatMap(f => {
  const p = join(dir, f);
  return statSync(p).isDirectory() ? walk(p) : p.endsWith('.js') ? [p] : [];
});

const partOfFile = rel => {
  const m = rel.match(/^js\/play\/(\w+)\.js$/);
  if (m && PARTS.includes(`play-${m[1]}`)) return `play-${m[1]}`;
  if (rel === 'js/games.js') return 'games';
  if (rel === 'js/school.js' || rel === 'js/lessons.js') return 'school';
  if (rel === 'js/coloring.js') return 'coloring';
  if (rel === 'js/pix.js') return 'pixels';
  return 'core';
};

const unescape = (s, q) => s.replace(/\\(u\{[0-9a-fA-F]+\}|u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)/g, (m, c) => {
  if (c[0] === 'u') return String.fromCodePoint(parseInt(c.replace(/[u{}]/g, ''), 16));
  if (c[0] === 'x') return String.fromCharCode(parseInt(c.slice(1), 16));
  return { n: '\n', t: '\t', '\\': '\\', "'": "'", '"': '"', '`': '`' }[c] ?? c;
});

// Strips comments but keeps strings, so commented-out code is not collected.
function stripComments(src) {
  let out = '', i = 0, q = null;
  while (i < src.length) {
    const c = src[i], d = src[i + 1];
    if (q) {
      out += c;
      if (c === '\\') { out += d ?? ''; i += 2; continue; }
      if (c === q) q = null;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') { q = c; out += c; i++; continue; }
    if (c === '/' && d === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === '/' && d === '*') {
      // Keeps the line breaks, so line numbers still match the file.
      i += 2;
      while (i < src.length && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; }
      i += 2;
      continue;
    }
    // A regex literal can contain quotes; skip it when it plainly is one.
    if (c === '/' && /[(,=:!&|?{};[]\s*$/.test(out.slice(-3)) && d !== ' ') {
      let j = i + 1, cls = false;
      while (j < src.length && src[j] !== '\n') {
        if (src[j] === '\\') { j += 2; continue; }
        if (src[j] === '[') cls = true; else if (src[j] === ']') cls = false;
        else if (src[j] === '/' && !cls) break;
        j++;
      }
      if (src[j] === '/') { out += src.slice(i, j + 1); i = j + 1; continue; }
    }
    out += c;
    i++;
  }
  return out;
}

const CALL = /\b(t|N|plural)\(\s*(?:([^,()'"`]+?)\s*,\s*)?(['"`])((?:\\[\s\S]|(?!\3)[\s\S])*?)\3/g;

export function codePhrases() {
  const out = [];
  const problems = [];
  for (const file of walk(JS)) {
    const rel = relative(ROOT, file);
    if (rel.startsWith('js/lang/') || rel.startsWith('js/content/')) continue;
    const src = stripComments(readFileSync(file, 'utf8'));
    for (const m of src.matchAll(CALL)) {
      const [, fn, first, q, body] = m;
      if (fn === 'plural' && !first) continue;
      if (fn !== 'plural' && first) continue;
      if (q === '`' && body.includes('${')) {
        problems.push(`${rel}: ${fn}() with \${…} inside: use {name} placeholders instead: ${body.slice(0, 60)}`);
        continue;
      }
      const key = unescape(body, q);
      if (!CYR.test(key)) continue;
      out.push({ key, part: partOfFile(rel), where: rel, kind: fn === 'plural' ? 'plural' : 'ui' });
    }
  }
  return { out, problems };
}

const load = async rel => (await import(pathToFileURL(join(ROOT, rel)).href));

export async function contentPhrases() {
  const out = [];
  const add = (key, part, where, kind, note) => { if (key && CYR.test(key)) out.push({ key, part, where, kind, note }); };

  const { CHAPTERS } = await load('js/lessons.js');
  const fromFiles = new Map();
  for (const f of readdirSync(join(JS, 'content')).filter(f => /^lessons2?-/.test(f))) {
    for (const L of (await load(`js/content/${f}`)).default) fromFiles.set(L.id, f);
  }
  for (const ch of CHAPTERS) {
    add(ch.title, 'school', 'js/lessons.js', 'chapter title');
    add(ch.about, 'school', 'js/lessons.js', 'chapter text');
    for (const L of ch.lessons) {
      const f = fromFiles.get(L.id);
      const part = f?.startsWith('lessons2-') ? 'lessons-b' : 'lessons-a';
      const where = f ? `js/content/${f}` : 'js/lessons.js';
      add(L.title, part, where, 'lesson title');
      L.steps.forEach((s, i) => add(s.t, part, where, 'lesson step', `step ${i + 1} of «${L.title}», max ~95 chars`));
    }
  }
  const { PAGES } = await load('js/pages.js');
  for (const p of PAGES) add(p.title, 'coloring', 'js/pages.js', 'coloring page title');
  const { PIX, PIX_PACKS } = await load('js/pix.js');
  for (const p of PIX_PACKS) add(p.name, 'pixels', 'js/pix.js', 'pixel set name');
  for (const p of PIX) add(p.name, 'pixels', 'js/pix.js', 'pixel picture name');
  const { STICKERS } = await load('js/art.js');
  for (const s of Object.values(STICKERS)) add(s.name, 'core', 'js/art.js', 'sticker pack name');
  for (const f of ['lab.js', 'lab2.js']) {
    for (const c of (await load(`js/content/${f}`)).default) {
      add(c.name, 'lab', `js/content/${f}`, 'colour name');
      add(c.fact, 'lab', `js/content/${f}`, 'colour fact', 'max ~110 chars');
    }
  }
  for (const f of ['dice.js', 'dice2.js']) {
    const d = (await load(`js/content/${f}`)).default;
    for (const w of d.who) add(w, 'words', `js/content/${f}`, 'dice who');
    for (const w of d.does) add(w, 'words', `js/content/${f}`, 'dice does');
    for (const w of d.where) add(w, 'words', `js/content/${f}`, 'dice where');
  }
  for (const f of ['ideas.js', 'ideas2.js']) {
    for (const s of (await load(`js/content/${f}`)).default) add(s, 'words', `js/content/${f}`, 'idea of the day');
  }
  for (const pack of Object.values((await load('js/content/stickers2.js')).default)) add(pack.name, 'core', 'js/content/stickers2.js', 'sticker pack name');
  for (const f of ['world-guides.js', 'world-guides2.js']) {
    for (const list of Object.values((await load(`js/content/${f}`)).default)) {
      for (const g of list) add(g.name, 'core', `js/content/${f}`, 'creature (Russian accusative, after «Нарисовать»)');
    }
  }
  for (const [game, part] of [['dots', 'play-dots'], ['dictation', 'play-dictation'], ['oneline', 'play-oneline']]) {
    for (const suffix of ['', '-a', '-b']) {
      for (const p of (await load(`js/content/${game}${suffix}.js`)).default) add(p.name, part, `js/content/${game}${suffix}.js`, `${game} picture name`);
    }
  }
  return out;
}

// One owner per phrase: the first part that uses it. Kinds are kept, since a
// dice word or a plural needs a special form in some languages.
export async function allPhrases() {
  const { out: code, problems } = codePhrases();
  const content = await contentPhrases();
  const byKey = new Map();
  for (const p of [...code, ...content]) {
    const had = byKey.get(p.key);
    if (!had) byKey.set(p.key, { ...p, kinds: new Set([p.kind]), wheres: new Set([p.where]) });
    else {
      had.kinds.add(p.kind);
      had.wheres.add(p.where);
      if (PARTS.indexOf(p.part) < PARTS.indexOf(had.part)) had.part = p.part;
    }
  }
  return { phrases: [...byKey.values()], problems };
}

async function dictionaries(lang) {
  const parts = {};
  for (const part of PARTS) {
    try { parts[part] = (await load(`js/lang/${lang}/${part}.js`)).default || {}; } catch (e) { parts[part] = { __error: String(e) }; }
  }
  return parts;
}

const holes = s => [...String(s).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');

export async function check(langs = LANGS) {
  const { phrases, problems } = await allPhrases();
  const report = { phrases: phrases.length, problems: [...problems], langs: {} };
  for (const lang of langs) {
    const dicts = await dictionaries(lang);
    const merged = Object.assign({}, ...PARTS.map(p => dicts[p]));
    const r = { missing: {}, errors: [], unused: [], conflicts: [] };
    for (const p of PARTS) if (dicts[p].__error) r.errors.push(`${p}: the file does not load: ${dicts[p].__error}`);
    // The same phrase translated differently in two parts would depend on load order.
    const seen = new Map();
    for (const p of PARTS) {
      for (const [k, v] of Object.entries(dicts[p])) {
        if (seen.has(k) && seen.get(k)[1] !== v) r.conflicts.push(`«${k}» differs in ${seen.get(k)[0]} and ${p}`);
        else seen.set(k, [p, v]);
      }
    }
    const keys = new Set(phrases.map(p => p.key));
    for (const k of Object.keys(merged)) if (!keys.has(k) && k !== '__error') r.unused.push(k);
    for (const p of phrases) {
      const v = merged[p.key];
      if (typeof v !== 'string' || !v.trim()) { (r.missing[p.part] ||= []).push(p.key); continue; }
      const tag = `${p.part}: «${p.key.slice(0, 50)}»`;
      if (CYR.test(v)) r.errors.push(`${tag}: the translation contains Cyrillic`);
      if (holes(v.split('|').join(' ')) !== holes(p.key.split('|').join(' '))) {
        // Each placeholder must survive; plural forms may each carry {n}.
        const want = new Set(holes(p.key).split(',').filter(Boolean));
        const got = new Set(holes(v).split(',').filter(Boolean));
        if ([...want].some(x => !got.has(x)) || [...got].some(x => !want.has(x))) r.errors.push(`${tag}: placeholders differ: {${[...want]}} vs {${[...got]}}`);
      }
      if (p.kinds.has('plural') && v.split('|').length !== 2) r.errors.push(`${tag}: a plural needs exactly two forms "one|many"`);
      if (!p.kinds.has('plural') && !p.kinds.has('dice who') && !p.kinds.has('dice does') && v.includes('|') && !p.key.includes('|')) r.errors.push(`${tag}: a stray "|" in the translation`);
      if (lang === 'he' && p.kinds.has('dice who') && !/\|[mf]$/.test(v)) r.errors.push(`${tag}: a Hebrew dice "who" must end with |m or |f`);
      if (lang === 'he' && p.kinds.has('dice does') && v.split('|').length !== 2) r.errors.push(`${tag}: a Hebrew dice "does" needs "masculine|feminine"`);
      if (lang === 'en' && /[֐-׿]/.test(v)) r.errors.push(`${tag}: Hebrew letters in the English text`);
    }
    r.missingCount = Object.values(r.missing).reduce((a, l) => a + l.length, 0);
    report.langs[lang] = r;
  }
  return report;
}

export async function rawLiterals() {
  const lit = /(['"`])((?:\\[\s\S]|(?!\1)[\s\S])*?)\1/g;
  const found = [];
  for (const file of walk(JS)) {
    const rel = relative(ROOT, file);
    if (rel.startsWith('js/lang/') || rel.startsWith('js/content/') || rel === 'js/i18n.js' || rel === 'js/lessons.js') continue;
    const orig = readFileSync(file, 'utf8').split('\n');
    const src = stripComments(orig.join('\n'));
    const marked = new Set([...src.matchAll(CALL)].map(m => m.index + m[0].length - m[4].length - 1));
    for (const m of src.matchAll(lit)) {
      if (!CYR.test(m[2])) continue;
      const start = m.index + 1;
      if (marked.has(start)) continue;
      const line = src.slice(0, m.index).split('\n').length;
      // Text she never sees (an id, a log line) is marked so on its line.
      if (/i18n-skip/.test(orig[line - 1] || '')) continue;
      found.push(`${rel}:${line}: ${m[0].slice(0, 90).replace(/\n/g, ' ')}`);
    }
  }
  return found;
}

const [cmd = 'check', a, b] = process.argv.slice(2);
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  if (cmd === 'keys') {
    const { phrases } = await allPhrases();
    const out = {};
    for (const p of phrases) (out[p.part] ||= []).push({ key: p.key, kinds: [...p.kinds], where: [...p.wheres], note: p.note });
    console.log(JSON.stringify(out, null, 1));
  } else if (cmd === 'todo') {
    const r = await check([a]);
    const { phrases } = await allPhrases();
    const want = new Set(r.langs[a].missing[b] || []);
    console.log(JSON.stringify(phrases.filter(p => want.has(p.key)).map(p => ({ key: p.key, kinds: [...p.kinds], where: [...p.wheres], note: p.note })), null, 1));
  } else if (cmd === 'raw') {
    const r = await rawLiterals();
    console.log(r.join('\n'));
    console.log(`\n${r.length} unmarked Russian literals`);
  } else {
    const r = await check(a ? [a] : LANGS);
    let bad = r.problems.length;
    console.log(`${r.phrases} phrases`);
    for (const p of r.problems) console.log(`PROBLEM ${p}`);
    for (const [lang, x] of Object.entries(r.langs)) {
      console.log(`\n== ${lang}: ${x.missingCount} missing, ${x.errors.length} errors, ${x.conflicts.length} conflicts, ${x.unused.length} unused`);
      for (const [part, list] of Object.entries(x.missing)) console.log(`  missing ${part}: ${list.length}`);
      for (const e of x.errors) console.log(`  ERROR ${e}`);
      for (const e of x.conflicts) console.log(`  CONFLICT ${e}`);
      if (x.unused.length) console.log(`  unused: ${x.unused.slice(0, 8).map(u => `«${u.slice(0, 40)}»`).join(', ')}${x.unused.length > 8 ? ' …' : ''}`);
      bad += x.missingCount + x.errors.length + x.conflicts.length;
    }
    process.exit(bad ? 1 : 0);
  }
}
