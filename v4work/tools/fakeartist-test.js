// 7.23: tests the Fake Artist rules in src/fakeartist.js (the "rules" region, no screen code). Run: node v4work/tools/fakeartist-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/fakeartist.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//); if(!m) throw new Error("rules region not found");
const T = new Function(m[1] + "; return FAR;")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };
const ids = ["a", "b", "c", "d", "e"], line = [100, 100, 300, 250, 500, 400], mk = (extra, fake) => { let k = 0; return T.Game(Object.assign({players:ids, word:{w:"Pyramids", alt:["pyramid", "giza"]}, rand:() => (k++ * 0.37) % 1}, extra || {})); };
eq(T.Game({players:["a", "b"], word:{w:"x"}}), null, "needs 3 players");

// guess matching
eq(T.norm("The Pyramids!"), T.norm("pyramid"), "case, article and plural ignored"); ok(T.norm("Ice cream") === T.norm("icecream"), "spaces ignored"); ok(T.norm("") === "", "empty stays empty");

// line cleaning
eq(T.cleanPts([0, 0, 5, 5]), null, "a tiny line is refused"); eq(T.cleanPts([0, 0, 100]), null, "odd length refused"); eq(T.cleanPts("x"), null, "not a list"); eq(T.cleanPts(Array(122).fill(10)), null, "too many points");
eq(T.cleanPts([0, 0, 2000, 2000]), [0, 0, 1000, 750], "points are clamped to the canvas"); eq(T.cleanPts([0.4, 0.6, 100.2, 0]), [0, 1, 100, 0], "points are rounded"); eq(T.cleanPts([0, NaN, 100, 0]), null, "NaN refused");

// a full escape game: 2 rounds, vote, 2 rounds, vote
{ const g = mk(); eq(g.ph, "card", "starts on the card"); ok(!g.stroke(g.order[0], line, 0), "no drawing before the start"); ok(g.start(0), "start"); ok(!g.start(0), "start only once"); eq(g.ph, "draw", "drawing");
  const fake = g.fake, first = g.order[0]; ok(ids.includes(fake), "the fake is a player");
  ok(!g.stroke(g.order[1], line, 1), "only the player whose turn it is can draw"); ok(!g.stroke(first, [1, 1, 2, 2], 1), "a tiny line doesn't count and the turn stays"); eq(g.cur(), first, "same player still up");
  for(let r = 1; r <= 2; r++) for(let i = 0; i < 5; i++){ eq(g.cur(), g.order[i], "turn order"); ok(g.stroke(g.cur(), [10, 10, 300, 300, 500, 200], 1000), "stroke"); }
  eq(g.ph, "vote", "vote after round 2"); eq(g.strokes.length, 10, "ten lines"); eq(g.vn, 1, "first vote"); eq(g.strokes[9].r, 2, "round recorded");
  ok(!g.vote("a", "a"), "no voting for yourself"); ok(!g.vote("a", "zzz"), "no voting for a stranger"); ok(!g.vote("zzz", "a"), "strangers can't vote");
  const notFake = ids.filter(p => p !== fake); ids.forEach(p => g.vote(p, p === notFake[0] ? notFake[1] : notFake[0])); ok(g.allVoted(), "everyone voted");
  ok(g.endVote(2000), "end vote"); eq(g.caught, false, "someone else got the votes"); eq(g.ph, "between", "not caught: between"); ok(!g.vote("a", "b"), "no voting once it's over"); ok(g.cont(3000), "keep drawing"); eq(g.round, 3, "round 3"); eq(g.ph, "draw", "drawing again");
  for(let i = 0; i < 10; i++) ok(g.stroke(g.cur(), [10, 10, 300, 300], 4000), "stroke"); eq(g.ph, "vote", "second vote after round 4"); eq(g.vn, 2, "vote 2");
  ids.forEach(p => g.vote(p, p === notFake[0] ? notFake[1] : notFake[0])); g.endVote(5000); eq(g.ph, "reveal", "second miss: the fake escapes"); eq(g.outcome, "escape", "escape");
  eq(g.deltas[fake], 3, "the fake gets 3"); notFake.forEach(p => eq(g.deltas[p], 0, "real artists get nothing for a wrong vote")); }

// caught at vote 1: wrong guess, judged wrong
{ const g = mk(), fake = g.fake; g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1); ids.forEach(p => g.vote(p, p === fake ? ids.find(x => x !== fake) : fake)); g.endVote(10);
  eq(g.caught, true, "caught"); eq(g.ph, "guess", "guess"); ok(!g.cont(11), "can't continue once caught"); ok(g.sendGuess("the Sphinx"), "wrong guess sent"); eq(g.ph, "judge", "the host decides when it doesn't match"); ok(g.judge(false), "judged wrong"); eq(g.outcome, "wrong", "wrong");
  ids.forEach(p => eq(g.deltas[p], p === fake ? 0 : 2, "real artists: 1 for the catch and 1 for voting right")); }
// caught, correct typed guess is accepted automatically; the fake's own vote doesn't count as a bonus
{ const g = mk(), fake = g.fake; g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1); ids.forEach(p => g.vote(p, p === fake ? ids.find(x => x !== fake) : fake)); g.endVote(10);
  ok(g.sendGuess(" GIZA "), "alternative spelling"); eq(g.outcome, "right", "accepted without the host"); eq(g.deltas[fake], 2, "the fake gets 2"); ids.filter(p => p !== fake).forEach(p => eq(g.deltas[p], 1, "bonus only for voting the fake")); }
// a host can overrule: right
{ const g = mk(), fake = g.fake; g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1); ids.forEach(p => g.vote(p, fake === p ? ids.find(x => x !== fake) : fake)); g.endVote(10); g.sendGuess("pyramyds"); ok(g.judge(true), "host says right"); eq(g.outcome, "right", "right"); }
// a tie on top does not catch the fake
{ const g = mk(), fake = g.fake, others = ids.filter(p => p !== fake); g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1);
  g.vote(others[0], fake); g.vote(others[1], fake); g.vote(others[2], others[0]); g.vote(others[3], others[0]); g.vote(fake, others[1]); g.endVote(10); eq(g.tally[fake], 2, "tally"); eq(g.caught, false, "a tie is not a catch"); eq(g.ph, "between", "carry on"); }
// nobody votes: not caught
{ const g = mk(); g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1); g.endVote(10); eq(g.caught, false, "no votes, no catch"); eq(g.ph, "between", "between"); }

// clocks: an idle turn is skipped after 45 s, the vote ends after 30 s, a guess that never comes counts as wrong after 30 s
{ const g = mk(); g.start(1000); const first = g.cur(); ok(!g.tick(45999), "not yet"); ok(g.tick(46000), "idle turn skipped"); ok(g.cur() !== first, "next player"); eq(g.strokes.length, 0, "no line from a skipped turn");
  ok(g.skip(46001), "the host can skip"); for(let i = 0; i < 8; i++) g.skip(46002); eq(g.ph, "vote", "ten skipped turns still reach the first vote"); }
{ const g = mk(); g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 100); ok(!g.tick(29000 + 100), "vote still open"); ok(g.tick(100 + 30000), "vote time up"); eq(g.ph, "between", "empty vote = not caught"); }
{ const g = mk(), fake = g.fake; g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1); ids.forEach(p => g.vote(p, p === fake ? ids.find(x => x !== fake) : fake)); g.endVote(10); ok(!g.tick(29000), "waiting for the guess"); ok(g.tick(30010), "no guess in time"); eq(g.outcome, "wrong", "counts as wrong"); }
// the fake can be first (plain shuffle): over many games every seat gets the fake sometimes
{ const seats = new Set(); for(let i = 0; i < 400; i++){ const g = T.Game({players:ids, word:{w:"x"}}); seats.add(g.order.indexOf(g.fake)); } eq([...seats].sort(), [0, 1, 2, 3, 4], "the fake can sit in any seat, the first included"); }
// 7.48: the most-voted player is recorded (also when they weren't the fake), ties list everyone, and Round 4 can be switched off
{ const g = mk(), fake = g.fake, nf = ids.filter(p => p !== fake); g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1); ids.forEach(p => g.vote(p, p === nf[0] ? nf[1] : nf[0])); g.endVote(10);
  eq(g.top, [nf[0]], "the most-voted player is not the fake"); eq(g.topN, 4, "four votes"); eq(g.extra, 2, "two more rounds by default"); }
{ const g = mk(), fake = g.fake; g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1); ids.forEach(p => g.vote(p, p === fake ? ids.find(x => x !== fake) : fake)); g.endVote(10); eq(g.top, [fake], "the fake got the most votes"); }
{ const g = mk(), nf = ids.filter(p => p !== mk().fake); g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1); const a = ids[0], b = ids[1]; g.vote(ids[0], ids[1]); g.vote(ids[1], ids[0]); g.vote(ids[2], ids[0]); g.vote(ids[3], ids[1]); g.vote(ids[4], ids[2]); g.endVote(10); eq(g.top.slice().sort(), [a, b], "a tie lists both"); eq(g.topN, 2, "two each"); }
{ const g = mk({extra:1}), fake = g.fake, nf = ids.filter(p => p !== fake); eq(g.extra, 1, "round 4 off"); g.start(0); for(let i = 0; i < 10; i++) g.stroke(g.cur(), line, 1); eq(g.vn, 1, "first vote after round 2");
  ids.forEach(p => g.vote(p, p === nf[0] ? nf[1] : nf[0])); g.endVote(10); g.cont(20); for(let i = 0; i < 4; i++) g.stroke(g.cur(), line, 30); eq(g.ph, "draw", "still drawing"); g.stroke(g.cur(), line, 31); eq(g.ph, "vote", "second vote right after round 3"); eq(g.vn, 2, "vote 2"); eq(g.strokes.length, 15, "fifteen lines in total"); }
console.log("fakeartist rules: " + n + " checks passed");
