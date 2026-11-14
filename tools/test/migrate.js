// Настя's iPad holds progress from before profiles existed. It must open
// straight at home, in Russian, with her name, without asking anything.
// Run with --state '{"stars":12,"best":{"x":3},"sound":false}' (no "onboarded").
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
check(location.hash !== '#/hello', 'an old device is not sent to the first-launch screen');
check(document.documentElement.lang === 'ru', `an old device stays Russian, got ${document.documentElement.lang}`);
check(T.q('.hello h1')?.textContent.includes('Привет, Настя!'), `home greets Настя: ${T.q('.hello h1')?.textContent}`);
const st = T.state();
check(st.onboarded === true && st.name === 'Настя' && st.lang === 'ru', 'her profile is filled in from the old data');
check(st.stars === 12 && st.best?.x === 3 && st.sound === false, 'her stars and settings are kept');
check(!!st.player?.id, 'she gets a player id');
return { problems };
