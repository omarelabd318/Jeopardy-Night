// 6.100: tests the For Sale? rules and referee in src/forsale.js (the "rules" region, no screen code). Run: node v4work/tools/forsale-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/forsale.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//); if(!m) throw new Error("rules region not found");
const R = new Function(m[1] + "; return SLR;")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };
const names = ["Ali", "Mona", "Sara", "Karim", "Nour", "Omar"], roster = k => names.slice(0, k).map(x => ({p:"p" + x, n:x}));
const mk = (k, rnd) => { const g = R.Game({}, roster(k), rnd); g.start(); return g; };

// the decks: 30 deeds, 30 cheques (two 0M, none for 1M, two each of 2M to 15M)
eq(R.PROPS.length, 30, "30 deeds"); eq(R.CHEQUES.length, 30, "30 cheques"); eq(R.CHEQUES.filter(q => q === 0).length, 2, "two 0M"); ok(!R.CHEQUES.includes(1), "no 1M");
for(let q = 2; q <= 15; q++) eq(R.CHEQUES.filter(x => x === q).length, 2, "two of " + q);
// setup per player count
eq(R.plan(3), {remove:6, coins:18, rounds:8}); eq(R.plan(4), {remove:2, coins:18, rounds:7}); eq(R.plan(5), {remove:0, coins:14, rounds:6}); eq(R.plan(6), {remove:0, coins:14, rounds:5});
ok(R.Game({}, roster(2)) === null && R.Game({}, [...roster(6), {p:"pX", n:"X"}]) === null, "3 to 6 players only");
for(let k = 3; k <= 6; k++){ const g = mk(k), pl = R.plan(k); eq(g.deck.length + k, 30 - pl.remove, "deck after the first deal"); eq(g.cdeck.length, 30 - pl.remove, "cheque deck"); eq(g.table.length, k, "one deed per player");
  ok(g.table.every((c, i, a) => !i || a[i - 1] < c), "deeds sorted low to high"); eq(g.ps[0].coins, pl.coins, "starting coins"); }

// a round: passing takes the cheapest deed and returns half the bid (rounded down); the last one left pays in full for the best
let g = mk(3, () => 0), tb = g.table.slice();   // rnd 0: seat 0 starts
eq(g.turn, 0, "seat 0 starts");
eq(g.act("pAli", {k:"raise", d:1, s:g.step}).ok, true, "Ali opens at 1M"); eq(g.cur, 1);
eq(g.act("pAli", {k:"raise", d:1, s:g.step}).err, "turn", "not your turn");
eq(g.act("pMona", {k:"raise", d:3, s:g.step}).err, "bad", "only +1, +2, +5");
eq(g.act("pMona", {k:"raise", d:2, s:g.step - 1}).err, "stale", "a stale step is dropped");
eq(g.act("pMona", {k:"raise", d:5, s:g.step}).ok, true, "Mona goes to 6M"); eq(g.cur, 6); eq(g.top, 1);
eq(g.act("pSara", {k:"pass", s:g.step}).ok, true, "Sara passes with no bid"); eq(g.ps[2].hand, [tb[0]], "Sara took the cheapest deed"); eq(g.ps[2].coins, 18, "and paid nothing"); eq(g.turn, 0, "back to Ali");
eq(g.act("pAli", {k:"pass", s:g.step}).ok, true, "Ali passes on 1M"); eq(g.ps[0].hand, [tb[1]], "Ali took the next cheapest"); eq(g.ps[0].coins, 17, "1M bid: half rounds down to 0 back, so he pays the full 1M");

eq(g.phase, "sold", "two passes in a 3-player round end it"); eq(g.ps[1].hand, [tb[2]], "Mona pays 6M in full and takes the best"); eq(g.ps[1].coins, 12); eq(g.starter, 1, "Mona opens the next round");
eq(g.res.map(r => r.c), tb, "results sorted low to high"); ok(g.res[2].won && !g.res[0].won, "only the last bidder is marked as the winner");
// passing after a bid returns half, rounded down
g = mk(4, () => 0); g.act("pAli", {k:"raise", d:5, s:g.step}); g.act("pMona", {k:"raise", d:2, s:g.step}); g.act("pSara", {k:"pass", s:g.step}); g.act("pKarim", {k:"pass", s:g.step}); g.act("pAli", {k:"pass", s:g.step});
eq(g.ps[0].coins, 18 - 5 + 2, "Ali bid 5, got 2 back, paid 3"); eq(g.ps[1].coins, 11, "Mona paid 7 in full"); eq(g.phase, "sold");
// can't bid more than you have; a player with nothing can still pass
g = mk(3, () => 0); g.ps[0].coins = 4; g.act("pAli", {k:"raise", d:5, s:g.step}); eq(g.cur, 0, "a raise over your coins is refused"); eq(g.act("pAli", {k:"raise", d:5, s:g.step}).err, "coins");
eq(g.act("pAli", {k:"raise", d:2, s:g.step}).ok, true, "but 2M is fine");
// the turn skips players who passed, and the bid order wraps
g = mk(4, () => 0); g.act("pAli", {k:"raise", d:1, s:g.step}); g.act("pMona", {k:"pass", s:g.step}); g.act("pSara", {k:"raise", d:1, s:g.step}); eq(g.turn, 3, "Karim"); g.act("pKarim", {k:"raise", d:1, s:g.step}); eq(g.turn, 0, "wraps past Mona to Ali");
// timeout: the player on turn passes
g = mk(3, () => 0); g.timeout(); eq(g.ps[0].out, true, "timeout passes"); eq(g.turn, 1);
// everyone passes with no bids: the cheapest cards go in order and the last gets the best for free
g = mk(3, () => 0); tb = g.table.slice(); g.act("pAli", {k:"pass", s:g.step}); g.act("pMona", {k:"pass", s:g.step}); eq(g.phase, "sold"); eq(g.ps.map(x => x.coins), [18, 18, 18], "nobody paid"); eq(g.ps[2].hand, [tb[2]], "Sara gets the best for free");

// a whole game with random play: invariants every round, every count
for(let k = 3; k <= 6; k++) for(let rep = 0; rep < 60; rep++){
  const g = mk(k), pl = R.plan(k), pubs = []; let guard = 0; const seen = new Set();
  const allDeeds = () => g.ps.flatMap(x => x.hand).concat(g.table, g.deck);
  while(g.phase !== "over" && guard++ < 5000){
    if(g.phase === "bid"){ const x = g.ps[g.turn], r = Math.random(), d = [1, 2, 5][Math.floor(Math.random() * 3)];
      if(r < .45 && g.cur + d <= x.coins) ok(g.act(x.p, {k:"raise", d, s:g.step}).ok, "raise"); else ok(g.act(x.p, {k:"pass", s:g.step}).ok, "pass");
      ok(g.ps.every(y => y.coins >= 0), "nobody goes below zero"); }
    else if(g.phase === "sold"){ eq(g.ps.every(x => x.hand.length === g.round), true, "everyone holds one deed per round played"); eq(new Set(g.ps.flatMap(x => x.hand)).size, g.round * k, "no deed twice"); g.advance(); }
    else if(g.phase === "sell"){ g.ps.forEach(x => { if(Math.random() < .7) ok(g.act(x.p, {k:"pick", c:x.hand[Math.floor(Math.random() * x.hand.length)]}).ok, "pick"); });
      if(g.phase === "sell") g.timeout(); eq(g.phase, "reveal");
      const rv = g.rv; ok(rv.every((r, i) => !i || rv[i - 1].c > r.c) && rv.every((r, i) => !i || rv[i - 1].q >= r.q), "best deed gets best cheque"); g.advance(); }
    else if(g.phase === "reveal") g.advance(); }
  eq(g.phase, "over", "the game ends"); eq(g.round, pl.rounds, "buying rounds"); eq(g.sround, pl.rounds, "selling rounds");
  ok(g.ps.every(x => x.hand.length === 0 && x.chq.length === pl.rounds), "all deeds sold, one cheque each round");
  const o = g.over; eq(o.rows.length, k); ok(o.rows.every((r, i) => !i || o.rows[i - 1].total >= r.total), "rows sorted by money");
  ok(o.rows.every(r => r.total === r.coins + r.chq.reduce((a, b) => a + b, 0)), "total = coins + cheques"); ok(o.winners.length >= 1 && o.rows[0].rank === 1, "someone wins");
}
// the tiebreak: level money goes to the player with more coins, then they share
let G = mk(3); G.ps.forEach(x => { x.hand = []; }); G.ps[0].coins = 10; G.ps[0].chq = [9]; G.ps[1].coins = 12; G.ps[1].chq = [7]; G.ps[2].coins = 5; G.ps[2].chq = [3]; G.endGame();
eq(G.over.rows.map(r => r.n), ["Mona", "Ali", "Sara"], "more coins wins the tie"); eq(G.over.winners, ["Mona"]);
G = mk(3); G.ps[0].coins = 10; G.ps[0].chq = [9]; G.ps[1].coins = 10; G.ps[1].chq = [9]; G.ps[2].coins = 1; G.ps[2].chq = []; G.endGame(); eq(G.over.winners, ["Ali", "Mona"], "still level: they share"); eq(G.over.rows.map(r => r.rank), [1, 1, 3]);

// what a phone may see: the shared table has no coins and no hands; a phone only gets its own
G = mk(4, () => 0); let pub = JSON.stringify(G.pub()); ok(!/coins/.test(pub) && !/hand/.test(pub), "pub has no coins or hands"); const pv = G.priv("pMona"); eq(pv.coins, 18); eq(G.priv("nobody"), null);
G.act("pAli", {k:"pass", s:G.step}); ok(G.priv("pMona").hand.length === 0 && G.priv("pAli").hand.length === 1, "only my own deeds");
ok(JSON.stringify({pub:G.pub(), priv:Object.fromEntries(G.ps.map(x => [x.p, G.priv(x.p)]))}).length < 10000, "the table fits the relay");
console.log("forsale-test: " + n + " checks passed");
