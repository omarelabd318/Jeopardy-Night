// 7.4: tests the Taboo rules in src/taboo.js (the "rules" region, no screen code). Run: node v4work/tools/taboo-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/taboo.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//); if(!m) throw new Error("rules region not found");
const T = new Function(m[1] + "; return TBR;")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };
let cardNo = 0; const draw = lvl => ({w:"W" + (++cardNo) + lvl, ban:["a", "b", "c", "d", "e"]});
const mem = [["a0", "a1"], ["b0", "b1", "b2"], ["c0", "c1"], ["d0", "d1"]];
const mk = (nt, extra) => T.Game(Object.assign({teams:nt, tpr:2, secs:60, lsecs:30, skips:3, members:t => mem[t], draw}, extra || {}));
eq(T.Game({teams:1}), null, "needs 2 teams"); eq(T.Game({teams:5}), null, "at most 4");

// schedule: 3 rounds x tpr x teams turns, team order inside each turn pair, describers rotate within a team
{ const g = mk(2); eq(g.turns.length, 12, "12 turns"); eq(g.turns.slice(0, 4).map(t => t.r + ":" + t.t), ["1:0", "1:1", "1:0", "1:1"], "round 1 order");
  eq(g.ph, "ready", "ready first"); eq(g.cur.desc, "a0", "first describer"); eq(g.cur.val, 100, "round 1 is 100"); eq(g.cur.lvl, "e", "round 1 easy cards"); eq(g.cur.secs, 60, "60 s");
  ok(!g.got(0), "no card before the clock starts"); ok(g.start(1000), "start"); ok(!g.start(1000), "start only once"); eq(g.ph, "run", "running"); ok(g.cur.card.w.endsWith("e"), "easy card drawn"); eq(g.cur.dl, 61000, "deadline");
  // got, skip, buzz
  ok(g.got(2000), "got"); eq(g.scores, [100, 0], "+100"); ok(g.skip(3000), "skip"); eq(g.cur.skipsLeft, 2, "a skip used"); eq(g.scores, [100, 0], "skip is free");
  ok(!g.buzz(0, 1, "a1", 4000), "own team can't buzz"); ok(!g.buzz(null, 1, "x", 4000), "no team can't buzz"); ok(!g.buzz(1, 7, "b0", 4000), "bad foul index");
  const w0 = g.cur.card.ban[2]; ok(g.buzz(1, 2, "b0", 4000), "opponent buzz"); eq(g.scores, [50, 0], "buzz costs half"); eq(g.cur.res[2].word, w0, "buzzed word recorded"); eq(g.cur.res[2].by, "b0", "buzzer recorded");
  ok(g.buzz(1, 5, "b1", 5000), "the word itself is a foul"); eq(g.cur.res[3].word, "The word itself", "foul label"); ok(g.buzz(1, 6, "b1", 5000), "other foul"); eq(g.scores, [-50, 0], "scores can go below zero");
  eq(g.tally(), {got:1, skip:1, buzz:3}, "tally");
  // time runs out
  ok(!g.tick(60999), "not yet"); ok(g.tick(61000), "time up"); eq(g.ph, "recap", "recap"); eq(g.cur.res[g.cur.res.length - 1].r, "time", "the open card is dropped"); ok(!g.got(61001), "nothing after time");
  // undo a wrong buzz and a disputed got
  ok(g.undo(2), "undo buzz"); eq(g.scores[0], 0, "penalty removed"); ok(!g.undo(2), "undo only once"); ok(g.undo(0), "undo got"); eq(g.scores[0], -100 + 100 - 100 + 100 - 100 + 0, "got removed"); ok(!g.undo(1), "a skip has nothing to undo");
  ok(g.next(), "next turn"); eq(g.cur.team, 1, "team 2 up"); eq(g.cur.desc, "b0", "its first describer"); }

// skips cap, unlimited skips
{ const g = mk(2, {skips:1}); g.start(0); ok(g.skip(1), "skip 1"); ok(!g.skip(2), "no more skips"); const u = mk(2, {skips:99}); u.start(0); for(let i = 0; i < 20; i++) ok(u.skip(i + 1), "unlimited"); const z = mk(2, {skips:0}); z.start(0); ok(!z.skip(1), "none allowed"); }

// describers rotate through the team, a team of 3 loops back
{ const g = mk(2, {tpr:4}), seen = {0:[], 1:[]}; for(let i = 0; i < 8; i++){ seen[g.cur.team].push(g.cur.desc); g.start(i); g.tick(1e9); g.next(); }
  eq(seen[0].slice(0, 4), ["a0", "a1", "a0", "a1"], "team 1 rotates"); eq(seen[1].slice(0, 4), ["b0", "b1", "b2", "b0"], "team 2 rotates"); }

// rounds: values, shorter lightning clock
{ const g = mk(2, {tpr:1}); const vals = []; for(let i = 0; i < 6; i++){ vals.push([g.cur.round, g.cur.val, g.cur.secs, g.cur.lvl]); g.start(0); g.tick(1e9); g.next(); }
  eq(vals.map(v => v.join("/")), ["1/100/60/e", "1/100/60/e", "2/200/60/h", "2/200/60/h", "3/300/30/h", "3/300/30/h"], "rounds"); }

// finishing: the leader wins, a tie goes to sudden death for the tied teams only
{ const g = mk(3, {tpr:1}); for(let i = 0; i < 9; i++){ g.start(0); if(g.cur.team === 1) g.got(1); g.tick(1e9); g.next(); }
  eq(g.ph, "over", "game over"); eq(g.winners, [1], "team 2 wins"); eq(g.cur, null, "no turn after the end"); eq(g.stats().desc, {b0:1, b1:1, b2:1}, "stats count got by describer"); }
{ const g = mk(3, {tpr:1}); for(let i = 0; i < 9; i++){ g.start(0); if(g.cur.team < 2) g.got(1); g.tick(1e9); g.next(); }   // teams 1 and 2 tie
  eq(g.ph, "ready", "sudden death starts"); eq(g.cur.round, 4, "round 4"); eq([g.cur.team], [0], "tied team first"); eq(g.cur.secs, 30, "30 s"); eq(g.cur.val, 300, "300 a card");
  g.start(0); g.tick(1e9); g.next(); eq(g.cur.team, 1, "other tied team"); g.start(0); g.got(1); g.tick(1e9); ok(g.next(), "finish"); eq(g.ph, "over", "sudden death decides"); eq(g.winners, [1], "the one who scored wins"); }
{ const g = mk(2, {tpr:1}); let guard = 0; while(g.ph !== "over" && guard++ < 40){ g.start(0); g.tick(1e9); g.next(); }   // nobody ever scores: three sudden deaths, then a shared win
  eq(g.ph, "over", "ends"); eq(g.winners, [0, 1], "shared win"); eq(g.sd, 3, "three sudden deaths at most"); }

// a team with nobody to describe is skipped; last() marks the final recap
{ const g = T.Game({teams:2, tpr:1, secs:60, lsecs:30, skips:3, members:t => t === 1 ? [] : ["a0", "a1"], draw}); let k = 0; while(g.ph !== "over" && k++ < 20){ ok(g.cur.team === 0, "only team 1 plays"); g.start(0); g.tick(1e9); if(g.ph === "recap" && g.ti === g.turns.length - 1) ok(g.last(), "last recap"); g.next(); }
  eq(g.ph, "over", "still finishes"); }
console.log("taboo rules: " + n + " checks ok");
