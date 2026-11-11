# How a game under `js/play/` is built

This is a developer note. It is not part of the app that ships.

Klyaksa is a drawing app for one 8-year-old girl, Настя, on an iPad (Safari
home-screen web app, iPadOS 17 or later, finger or Apple Pencil). It is a
static site: plain ES modules, no build step, no libraries, no network.

## Files

Each game owns exactly two files and may edit nothing else:

- `js/play/<id>.js`, loaded on demand when she opens `#/game/<id>`
- `css/play/<id>.css`, already linked from `index.html`

The registry in `js/games.js` already lists every game (title, card, route), and
`sw.js` already caches both files.

## The module

```js
export default function run(root, arg, ...rest) {
  // root is an empty element: append one `.screen` to it.
  // arg is the next part of the address: '#/game/pairs/3' gives arg '3'.
  // Return a cleanup function. It must stop timers and animation frames,
  // remove listeners added to window or document, and destroy any Painter.
  return () => {};
}
```

With no `arg`, show the list of levels. With an `arg`, play that level.
Prefix every CSS class with the game id (`.pairs-card`), so games cannot clash.

## What is already there

Read these files before writing code. Reuse them; do not copy them.

- `js/util.js`: `h(tag, props, ...kids)` builds DOM (`class`, `style` object,
  `onclick`, `html`); `canvas(w, h)`, `svgEl(tag, attrs)`, `clamp`, `lerp`,
  `pick`, `shuffle`, `sleep`, `mulberry(seed)` (seeded random), `blobOf(canvas)`,
  `loadImg(blobOrUrl)`, `hexRgb`, `rgbHex`, `shade(hex, amount)`.
- `js/ui.js`: `topbar(title, { back, right })`, `btn(cls, content, onClick)`
  (`cls` is `primary`, `ghost`, `accent`; it ignores a second tap while an async
  handler runs), `iconBtn(name, label, fn)`, `icon(name)`, `mascot(mood)`,
  `speaker(text)` (the mascot with a speech bubble; `.say(text)` changes it),
  `toast(text)`, `confirmBox(text, yes, no)`, `celebrate({...})`, `starBadge()`,
  `paletteBar`, `sizeSlider`, `brushRail`, `COLORS`, `safeSave`, `autosaver`.
- `js/play/kit.js`: `levelScreen(root, { title, hint, levels })` draws the level
  list; `finishLevel({ levels, index, stars, title, text, menu, again })` pays the
  stars and shows the finish dialog; `starsOf(key)`; `isOpen(levels, i)`;
  `parseMoves`, `eulerInfo`.
  A level is `{ key, name, sub?, href, thumb? }`. `key` is where its stars are
  stored, for example `pairs:3`. Keys must never change once shipped.
- `js/store.js`: `state` (progress; `state.best[key]` is the star count),
  `award(key, stars)`, `db` (IndexedDB: `db.get/put/all/del(store, ...)` with the
  stores `art`, `world`, `kv`), `newId(prefix)`.
- `js/audio.js`: `sfx.pop()`, `sfx.ding()` (right), `sfx.soft()` (wrong, gentle),
  `sfx.drop()`, `sfx.fill()`, `sfx.squeak()`, `sfx.win()`.
- `js/pix.js`: `PIX` (128+ pixel pictures: `{ id, name, a: [rows] }`), `PIX_KEY`
  (letter to colour), `PIX_PACKS`.
- `js/pages.js` and `js/coloring.js`: `PAGES` (coloring pages) and
  `drawPage(ctx, page, colored)`, which draws one at 1200 by 900.
- `js/lessons.js`: `ALL_LESSONS`, `allPaths(lesson)` (outline paths, 1000 by 750).
- `js/painter.js`: the drawing surface, `new Painter(host, { w, h, layers })`.
  See `js/studio.js` and `js/world.js` for how it is used.
- `css/app.css`: design tokens (`--ink`, `--paper`, `--card`, `--sun`, `--coral`,
  `--mint`, `--sky`, `--grape`, `--pink`, `--line`) and the shared classes
  (`.screen`, `.screen.scroll`, `.btn`, `.tabs`, `.tab`, `.modal`, `.hub`).

## Look and feel

Match the rest of the app: cream paper, thick dark outlines (`var(--line)`),
rounded cards with a hard drop shadow (`0 5px 0 var(--ink)`), big friendly type.
Open the home screen and an existing game in the test driver and look at them.

## Rules that are not negotiable

- All text she reads is Russian, short and warm. She is addressed as a girl.
- Touch targets are at least 52 px. Nothing depends on hover or a keyboard.
- It must work with a finger and with Apple Pencil: use pointer events
  (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`), call
  `setPointerCapture` for drags, and set `touch-action: none` on the play area so
  the page does not scroll under her hand. Plain buttons can use `onclick`.
- Both orientations must work with nothing cut off and no sideways scrolling:
  1180 by 820 and 820 by 1180. Also check 1024 by 768.
- No timers that rush her, no lives, no penalties that take stars away, no
  random rewards. Stars come from how well she did (mistakes or moves), 1 to 3,
  and finishing always gives at least 1.
- The levels must get harder in a way she can feel: bigger boards, more steps,
  subtler differences, new twists in the later levels. State the ladder in a
  comment at the top of the module.
- Everything is original. No characters, names, art or level layouts taken from
  an existing game, cartoon or brand.
- No external files and no network. Sounds come from `sfx`.
- Progress that takes more than a minute must survive leaving the screen or the
  app being closed: store it with `db.put('kv', { id: '<game>_...', ... })` and
  clear it when the level is finished.
- Comments are short and say why, not what. No TODOs left behind.

## Testing in a real browser

The local server already runs on port 8123. Do not start or stop servers.

```bash
node tools/drive.mjs --route '#/game/pairs' --script /path/test.js --shot /path/out.png
```

Options: `--size 820x1180`, `--state '{"unlockAll":true}'` (opens every level),
`--timeout 120`. Every run starts with empty storage in its own browser, so runs
do not disturb each other.

The script file is the body of an async function running inside the page. It
returns a value, which is printed as JSON along with every page error. Helpers:

- `await T.go('#/game/pairs/1')` changes the address and waits.
- `await T.click(elOrSelectorOrButtonText)` calls `click()`.
- `await T.tap(el)` sends a pointer tap, for things that listen to pointer events.
- `await T.stroke([[x, y], ...], { el, type: 'touch', pause: 5 })` sends a drag.
- `T.q(sel)`, `T.qq(sel)`, `T.byText(text, sel)`, `T.center(el)`, `T.wait(ms)`.
- `T.overflow()` lists elements that stick out sideways (should be empty).
- `T.visible(el)` is true when the element is fully on screen.
- `T.state()` returns the saved progress.
- `await T.shot('/path/step.png')` saves a screenshot at that moment.

Look at the screenshots with the Read tool. A test that only checks that nothing
threw is not enough: play every level to the end with the helpers, check the
stars, and look at the pictures.

## Releases

`./deploy.sh` publishes the committed app and stamps the commit into the
offline cache name in `sw.js`. An installed copy downloads the new files in the
background (about 20 seconds) and then reloads by itself once she rests on the
home screen (`planUpdate` in `js/main.js`). Any new file under `js/` or `css/`
must be added to the list in `sw.js`, or it will be missing offline.
