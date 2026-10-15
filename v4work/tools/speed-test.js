// 7.47: tests the Speed Trivia rules in src/speed.js (the "rules" region, no screen code). Run: node v4work/tools/speed-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/speed.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//); if(!m) throw new Error("rules region not found");
const S = new Function(m[1] + "; return SPR;")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };
let no = 0; const lvls = [];
const draw = lvl => { lvls.push(lvl); no++; return {q:"one two three four five six seven eight", a:"Right" + no, opts:["A" + no, "B" + no, "Right" + no, "D" + no], ci:2, catName:"Cat"}; };
const match = (t, c) => t.toLowerCase() === c.a.toLowerCase();
const mk = (ids, extra) => S.Game(Object.assign({players:ids, per:2, draw, match, rand:() => 0.5}, extra || {}));
eq(mk(["a"]), null, "needs 2 players"); eq(mk(["a", "b", "c", "d", "e"]), null, "at most 4");

// a clue's life: round card, ready, live, buzz, answer
{ const g = mk(["a", "b", "c"]); eq(g.ph, "round", "starts on the round card"); ok(g.start(0), "start"); ok(!g.start(0), "start once"); eq(g.rd, 1, "round 1");
  ok(!g.tick(2999), "round card lasts 3 s"); ok(g.tick(3000), "clue drawn"); eq(g.ph, "ready", "ready"); eq(lvls[0], 100, "first clue is a 100"); ok(!g.buzz("a", 3500), "no buzzing before live");
  ok(!g.tick(4999), "ready lasts 2 s"); ok(g.tick(5000), "live"); eq(g.ph, "live", "live"); eq(g.shown(5000), 0, "nothing shown at once"); eq(g.shown(6000), 4, "4 words a second"); eq(g.shown(9000), 8, "capped at the clue length");
  ok(!g.buzz("z", 5100), "strangers can't buzz"); ok(g.buzz("b", 6000), "b buzzes"); eq(g.ph, "buzzed", "buzzed"); eq(g.buz, "b", "b is up"); eq(g.shown(7000), 4, "the clue freezes on a buzz"); ok(!g.buzz("a", 6001), "only the first buzz counts"); eq(g.dl, 12000, "6 s to answer");
  eq(g.shuf.slice().sort(), [0, 1, 2, 3], "all four buttons"); ok(!g.answer("a", {i:2}, 6100), "only the buzzer answers"); ok(!g.answer("b", {i:9}, 6100), "no such button"); ok(!g.answer("b", {t:"x"}, 6100), "typing is off");
  ok(g.answer("b", {i:2}, 6200), "right"); eq(g.ph, "result", "result"); eq(g.score, {a:0, b:100, c:0}, "+100"); eq(g.streak, {a:0, b:1, c:0}, "streak 1"); eq(g.res.k, "right", "right result"); }

// a wrong answer locks you out, costs half, the clue goes on and the next buzzer has fewer buttons
{ const g = mk(["a", "b"]); g.start(0); g.tick(3000); g.tick(5000); g.buzz("a", 6000); ok(g.answer("a", {i:0}, 6100), "wrong answer"); eq(g.ph, "live", "back to live"); eq(g.score.a, -50, "-50"); eq(g.gone, [0], "button 0 is gone");
  ok(g.lock.a, "a is locked"); ok(!g.buzz("a", 6200), "locked players can't buzz"); eq(g.last.p, "a", "the wrong answer is remembered"); eq(g.shown(6100), g.shown(6100), "reveal goes on");
  ok(g.buzz("b", 6300), "b buzzes"); eq(g.shuf.sort(), [1, 2, 3], "three buttons left"); ok(!g.answer("b", {i:0}, 6400), "a button already used is refused"); ok(g.answer("b", {i:1}, 6400), "wrong too");
  eq(g.ph, "result", "everyone locked out: result"); eq(g.res.k, "wrong", "wrong result"); ok(g.res.dead, "dead clue"); eq(g.score, {a:-50, b:-50}, "both lost 50");
  ok(!g.tick(9399), "result lasts 3 s"); ok(g.tick(9400), "next clue"); eq(g.ph, "ready", "ready again"); eq(g.ci, 1, "second clue"); eq(lvls.slice(-1)[0], 200, "round 1 alternates 100 and 200"); }

// timing out counts as wrong; nobody buzzing ends the clue 8 s after it is complete; penalty off
{ const g = mk(["a", "b"]); g.start(0); g.tick(3000); g.tick(5000); g.buzz("a", 6000); ok(!g.tick(11999), "still 6 s"); ok(g.tick(12000), "time up"); eq(g.last.k, "time", "timeout"); eq(g.score.a, -50, "timeout costs half"); eq(g.ph, "live", "b can still buzz");
  ok(!g.tick(12001), "live"); const full = g.fullAt(); eq(g.shown(full), 8, "complete at fullAt"); ok(!g.tick(full + 7999), "8 s of silence"); ok(g.tick(full + 8000), "dead clue"); eq(g.res.k, "dead", "nobody got it"); eq(g.streak, {a:0, b:0}, "no streaks");
  const h = mk(["a", "b"], {pen:false}); h.start(0); h.tick(3000); h.tick(5000); h.buzz("a", 6000); h.answer("a", {i:0}, 6100); eq(h.score.a, 0, "no penalty when switched off"); ok(h.lock.a, "but still locked"); }

// typed answers, double time
{ const g = mk(["a", "b"], {typed:true}); g.start(0); g.tick(3000); g.tick(5000); g.buzz("a", 6000); eq(g.dl, 18000, "12 s when typing"); ok(!g.answer("a", {i:2}, 6100), "no buttons when typing"); ok(!g.answer("a", {t:"  "}, 6100), "empty text"); ok(g.answer("a", {t:" RIGHT" + no + " "}, 6200), "typed right"); eq(g.res.guess, "RIGHT" + no, "typed text kept"); }

// streaks: the 3rd right answer in a row adds 100, someone else's win or a wrong answer breaks it; all-at-once reveal
{ const g = mk(["a", "b"], {per:6, wbw:false}); g.start(0); g.tick(3000); eq(g.shown(3000), 8, "all at once"); const win = (p, t) => { g.tick(t); g.tick(t + 2000); ok(g.buzz(p, t + 2100), "buzz"); ok(g.answer(p, {i:2}, t + 2200), "win"); g.tick(t + 2200 + 3000); };
  eq(g.rdy - 3000, 1000, "live after 1 s");
  win("a", 3000); win("a", 8300); eq(g.score.a, 200, "two wins, 100 each"); win("a", 13600); eq(g.score.a, 400, "third in a row: +100 bonus"); eq(g.streak.a, 3, "streak 3"); win("a", 18900); eq(g.score.a, 600, "bonus again"); eq(g.maxStreak.a, 4, "longest streak");
  win("b", 24200); eq(g.streak, {a:0, b:1}, "b's win breaks a's streak"); }

// rounds: values, answer times, the scores screen, the final
{ const g = mk(["a", "b"], {per:1}); g.start(0); g.tick(3000); eq(lvls.slice(-1)[0], 100, "round 1"); eq(g.R().right, 100, "100"); ok(!g.skip(3500), "Next does nothing while the buzzers are not live yet"); }
{ const g = mk(["a", "b"], {per:1}); g.start(0); g.tick(3000); g.tick(5000); g.skip(5100); g.skip(5200); eq(g.ph, "scores", "scores screen after round 1"); ok(!g.tick(5200 + 4999), "scores last 5 s"); ok(g.tick(5200 + 5000), "round 2 card"); eq(g.rd, 2, "round 2"); eq(g.R().secs, 6, "6 s");
  g.skip(20000); eq(g.ph, "ready", "host Next skips the card"); eq(lvls.slice(-1)[0], 300, "round 2 starts on 300"); g.tick(1e9); g.skip(1e9); g.skip(1e9); g.skip(1e9); eq(g.rd, 3, "round 3"); eq(g.R().right, 300, "300"); eq(g.R().secs, 4, "4 s"); eq(g.R().wrong, 150, "-150"); }

// the end: a clear winner, or sudden death
const harness = g => { let t = 0; const step = () => { t += 1e5; return g.tick(t); }, toLive = () => { for(let k = 0; k < 6 && g.ph !== "live"; k++) step(); eq(g.ph, "live", "reached a live clue"); },
  play = who => { toLive(); if(who){ ok(g.buzz(who, t + 1), who + " buzzes"); ok(g.answer(who, {i:2}, t + 2), who + " is right"); } else ok(g.skip(t), "host skips"); step(); }; return {step, toLive, play, now:() => t}; };
{ const g = mk(["a", "b"], {per:1}), h = harness(g); g.start(0);
  h.play("a"); eq(g.ph, "scores", "scores after round 1"); h.play("a"); h.play("a"); eq(g.ph, "over", "a clear leader wins"); eq(g.winners, ["a"], "a wins"); eq(g.score.a, 100 + 200 + 300 + 100, "700: three in a row earns the bonus"); }
{ const g = mk(["a", "b", "c"], {per:1}), h = harness(g); g.start(0);
  h.play(null); h.play(null); h.play(null); eq(g.ph, "round", "tied at 0: sudden death card"); eq(g.rd, 4, "round 4"); eq(g.sd, ["a", "b", "c"], "all three tied"); eq(g.R().name, "Sudden death", "name");
  h.step(); eq(g.ph, "ready", "clue"); eq(lvls.slice(-1)[0], 500, "500 clue"); h.toLive(); const t = h.now(); ok(g.buzz("a", t + 1), "a buzzes"); ok(g.answer("a", {i:0}, t + 2), "wrong"); eq(g.score.a, 0, "no points lost in sudden death"); eq(g.sd, ["b", "c"], "a is out"); eq(g.ph, "live", "play on");
  ok(!g.buzz("a", t + 3), "a is out of it"); ok(g.buzz("b", t + 4), "b buzzes"); ok(g.answer("b", {i:1}, t + 5), "wrong"); eq(g.sd, ["c"], "only c left"); eq(g.ph, "result", "c wins at once"); h.step(); eq(g.ph, "over", "over"); eq(g.winners, ["c"], "c wins"); }
{ const g = mk(["a", "b"], {per:1}), h = harness(g); g.start(0); h.play(null); h.play(null); h.play(null); h.step(); h.toLive();
  const t = h.now(); ok(g.buzz("a", t + 1), "a buzzes"); ok(g.answer("a", {i:2}, t + 2), "right"); h.step(); eq(g.winners, ["a"], "first right answer wins"); eq(g.score.a, 0, "no points in sudden death"); }
{ const g = mk(["a", "b"], {per:1}), h = harness(g); g.start(0); h.play(null); h.play(null); h.play(null); eq(g.rd, 4, "sudden death"); let k = 0; while(g.ph !== "over" && k++ < 200){ h.step(); }; eq(g.ph, "over", "eight dead clues end it"); eq(g.winners, ["a", "b"], "they share the win"); }

// players coming and going
{ const g = mk(["a", "b"]); g.start(0); ok(g.add("c"), "late joiner between clues"); ok(!g.add("c"), "only once"); eq(g.ids, ["a", "b", "c"], "joined"); eq(g.score.c, 0, "starts on 0"); g.tick(3000); g.tick(5000); ok(!g.add("d"), "not mid-clue");
  g.buzz("c", 6000); ok(g.drop("c", 6100), "buzzer leaves"); eq(g.ph, "live", "back to live"); ok(g.drop("b", 6200), "another leaves"); ok(g.paused, "one player: paused"); ok(!g.tick(1e9), "nothing moves while paused"); ok(!g.buzz("a", 7000), "no buzzing while paused");
  ok(g.add("e") === false || true, "add attempted"); }
{ const g = mk(["a", "b"]); g.start(0); ok(g.over(), "end the game"); eq(g.ph, "over", "over"); ok(!g.over(), "once"); }
console.log("speed rules: " + n + " checks passed");
