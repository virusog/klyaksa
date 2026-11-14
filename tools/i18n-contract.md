# Three languages: how text works in Klyaksa

This is a developer note. It is not part of the app that ships.

The app speaks Russian, English and Hebrew. Hebrew is written right to left.
The player is a girl (the app addresses her in the feminine in Russian and
Hebrew). Russian is the source language: code and content are written in
Russian, and `js/lang/en/` and `js/lang/he/` map each Russian phrase to its
translation.

## The API (js/i18n.js)

```js
import { t, N, plural, gendered, lang, dir } from './i18n.js';

t('Готово')                                    // the phrase in the current language
t('Привет, {name}!', { name: state.name })     // placeholders in braces, never ${…}
N('Кисть «Блёстки»')                           // marks a phrase where it is DEFINED (a list, a table);
                                                // show it later with t(item.name)
plural(n, '{n} кадр|{n} кадра|{n} кадров')     // three Russian forms (1 / 2-4 / 5+); English and Hebrew give two
gendered(who, does)                            // the dice game: Hebrew verbs agree with the subject
lang                                           // 'ru' | 'en' | 'he'
dir                                            // 'ltr' | 'rtl'
```

Rules:

- The argument of `t()`, `N()` and the second argument of `plural()` must be a
  plain string literal, with no `${…}` inside, so `tools/i18n.mjs` can find it.
  Build sentences with placeholders: `t('{a} из {b}', { a, b })`, never by
  gluing translated pieces together (word order differs between languages).
- Keep the Russian text exactly as it is now. It is the key; changing it would
  only make translation harder. Only split out the changing parts into
  placeholders.
- Translate at the moment of showing, not at module load:
  `topbar(t('Пазл'))` inside the screen function is right; a module-level
  `const TITLE = t('Пазл')` is also fine because the language never changes
  while the app runs (switching language reloads the page). Lists of data
  (level names, colour names) keep the Russian in the data, marked with `N()`
  if they live in code, and are shown with `t(x.name)`.
- Data modules under `js/content/` and the lesson data in `js/lessons.js` stay
  plain Russian: the checker reads them directly. Their text is shown with
  `t(...)` where it is displayed (lesson titles and steps, page titles, pixel
  names, colour names and facts, dots/dictation/one-line names, idea of the day,
  dice words, sticker pack names, living-world creature names).
- Anything she reads counts: text in elements, `aria-label`, `title`,
  `placeholder`, toasts, dialogs, speech (`speak()`), alerts.
- Text she never sees (an id, a log line, a regex) stays as it is; put the
  comment `// i18n-skip` on that line so the checker leaves it alone.
- Numbers, star symbols and emoji are not translated.
- Grammar that depends on a number goes through `plural()`. Delete any local
  plural helper of your own and use the shared one.
- A Russian phrase that is the same in two places is one key: that is fine.

## Checking

```bash
node tools/i18n.mjs raw          # Russian text in code not marked yet (must reach 0 for your files)
node tools/i18n.mjs check        # missing or broken translations, per language
node tools/i18n.mjs todo he core # the phrases of one part still to translate, as JSON
```

Dictionaries: `js/lang/<lang>/<part>.js`, one per part:
`export default { 'Русская фраза': 'Translation', ... };`.
Parts: `core` (shell, studio, gallery, world, rating, profile, stickers, brushes,
papers), `school` (school screens, chapter titles), `lessons-a` and `lessons-b`
(lesson titles and steps), `coloring`, `games` (games.js), `pixels`, `words`
(ideas of the day, dice), `lab` (colour lab), and one `play-<id>` per newer game.
`node tools/i18n.mjs keys` shows which phrase belongs to which part.

## Writing the translations

- English: warm, simple, natural for an 8-year-old, British/American neutral.
  The app and its mascot are called **Blobika**: Блобика in Russian, Blobika in English, בלוביקה in Hebrew (feminine).
- Hebrew: natural Israeli Hebrew for a girl in second or third grade, without
  niqqud except where a word would be ambiguous for a child. Address her in the
  feminine singular (תצירי, את, בחרי, ציירי). The app and the mascot are called
  **בלוביקה**. Use Hebrew quotation marks or none, not «ёлочки».
- Keep every `{placeholder}` exactly. A plural gets exactly two forms
  `"{n} frame|{n} frames"`; in Hebrew use the form a child would read, e.g.
  `"פריים אחד|{n} פריימים"` is fine.
- Dice words (kind `dice who` / `dice does`): in Hebrew a "who" value ends with
  its gender, `"דרקון|m"` or `"פרה|f"`; a "does" value gives both forms,
  `"אוכל גלידה|אוכלת גלידה"`. The sentence is "<who> <does> <where>". English
  needs no marks: `"a cat"`, `"eats ice cream"`, `"in space"`.
- Creature names in the living world are the object of «Нарисовать ...»
  ("Draw ..."): give the form that fits after "Draw"/"צַיְּרִי": `"a fish"`, `"דג"`.
- Lesson steps teach drawing: keep the tip accurate and the text short
  (about 95 characters at most; Hebrew is usually shorter, English a bit longer).
- Names of pictures, levels and colours must stay unique within a list.
- Do not translate emoji, numbers or the placeholder names.

## Hebrew is right to left

`<html dir="rtl">` is set for Hebrew. Text, menus and top bars mirror. Play
surfaces do not: canvases, boards, grids, puzzles, the drawing sheet, colour
gradients and pattern rows keep their left-to-right geometry, because pointer
positions and pictures are measured left to right. Put `dir="ltr"` on such a
play surface element. Prefer logical CSS properties
(`margin-inline-start`, `inset-inline-end`, `text-align: start`) for chrome.
