// A device without a class code is never sent to the server, and the rating
// screen asks for the class instead. Typing a code joins that class.
// Uses the pretend server of tools/drive.mjs (class 'test-class' has two girls).
const problems = [];
const check = (ok, msg) => { if (!ok) problems.push(msg); };
const sent = [];
const real = window.fetch;
window.fetch = (url, opts) => { if (/klyaksa_save/.test(url)) sent.push(JSON.parse(opts.body)); return real(url, opts); };

await T.wait(2500);
check(sent.length === 0, `nothing is sent without a class (${sent.length} saves)`);
await T.go('#/rating', 800);
const field = T.q('.rating-code');
check(!!field && !T.q('.rating-row'), 'the rating asks for the class code');
field.value = 'bad code!';
await T.click(T.q('.rating-empty .btn.primary'), 300);
check(!T.state().classCode && !!T.q('.toast'), 'a wrong code is refused with a hint');
field.value = 'Test-Class';
await T.click(T.q('.rating-empty .btn.primary'), 2000);
check(T.state().classCode === 'test-class', `a typed code joins the class (${T.state().classCode})`);
check(sent.some(b => b.p_class === 'test-class'), 'and her stars are sent to that class');
const rows = T.qq('.rating-row');
check(rows.length === 3 && !!T.q('.rating-row.me'), `the class board shows her and two classmates (${rows.length} rows)`);
window.fetch = real;
return { problems };
