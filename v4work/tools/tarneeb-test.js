// 6.80: tests the Tarneeb rules and referee in src/tarneeb.js (the "rules" region, no screen code). Run: node v4work/tools/tarneeb-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/tarneeb.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//);
if(!m) throw new Error("rules region not found");
const T = new Function(m[1] + "; return TNR;")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };

// calls rank by number first, then suit (clubs lowest, spades highest); 1 means 7 tricks
ok(T.beats({n:2, s:"S"}, {n:2, s:"H"}), "2S beats 2H");
ok(T.beats({n:3, s:"C"}, {n:2, s:"S"}), "3C beats 2S");
ok(!T.beats({n:2, s:"H"}, {n:2, s:"S"}) && !T.beats({n:2, s:"H"}, {n:2, s:"H"}), "lower or equal doesn't beat");
ok(T.tricksFor({n:1}) === 7 && T.tricksFor({n:3}) === 9 && T.tricksFor({n:7}) === 13, "1 means 7 tricks, 7 means 13");

// scoring examples from the framework doc
const S = T.scoreHand;
eq(S(0, {n:3, s:"H"}, [10, 3], false), [10, 0], "made 9, took 10");
eq(S(0, {n:3, s:"H"}, [7, 6], false), [-9, 6], "missed");
eq(S(0, {n:3, s:"H"}, [13, 0], false), [16, 0], "all 13 without calling 7");
eq(S(0, {n:7, s:"S"}, [13, 0], false), [26, 0], "called 7, made");
eq(S(0, {n:7, s:"S"}, [12, 1], false), [-16, 1], "called 7, missed");
eq(S(1, {n:3, s:"H"}, [3, 10], true), [0, 20], "doubled, made");
eq(S(0, {n:3, s:"H"}, [7, 6], true), [-18, 12], "doubled, missed");
eq(S(0, {n:7, s:"S"}, [13, 0], true), [52, 0], "doubled Kaboot");
eq(S(0, {n:3, s:"H"}, [13, 0], true), [32, 0], "doubled all 13");
eq(S(0, {n:1, s:"C"}, [8, 5], false, {defenders:true}), [8, 5], "defenders always score");
ok(T.winner([31, 20], 31) === 0 && T.winner([30, 20], 31) === -1 && T.winner([33, 35], 31) === 1 && T.winner([32, 32], 31) === 2, "winner");

// auction: flow, raising, three passes end it
let a = T.auction(3);                                    // dealer is seat 3, so seat 0 speaks first
ok(a.turn === 0, "first to speak is after the dealer");
ok(T.doCall(a, 0, {n:1, s:"C"}) && a.turn === 1, "call moves the turn");
ok(!T.doCall(a, 1, {n:1, s:"C"}) && !T.doCall(a, 1, {n:1.5, s:"S"}) && !T.doCall(a, 1, {n:8, s:"S"}), "can't repeat, fractions or 8");
ok(T.doCall(a, 1, {n:2, s:"D"}), "raise");
ok(T.doPass(a, 2) && T.doPass(a, 3), "pass, pass");
ok(a.turn === 0 && !a.done, "outbid caller 0 may raise");
ok(T.doPass(a, 0) && a.done && a.result === "won" && a.high.seat === 1, "third pass ends it, seat 1 wins");
// a double ends the auction at once, only by an opponent of the high call, even one who passed
a = T.auction(3); T.doCall(a, 0, {n:2, s:"S"});
ok(!T.canDouble(a, 2) && !T.canDouble(a, 0) && T.canDouble(a, 1) && T.canDouble(a, 3), "only opponents double");
T.doPass(a, 1); ok(T.canDouble(a, 1), "an opponent who passed may still double");
ok(T.doDouble(a, 3) && a.done && a.doubled && a.result === "won", "double ends the auction");
ok(!T.doCall(a, 1, {n:3, s:"S"}) && !T.doDouble(a, 1) && !T.doPass(a, 1), "nothing after a double");
a = T.auction(0); ok(!T.canDouble(a, 1), "can't double before any call");
a = T.auction(0); T.doPass(a, 1); T.doPass(a, 2); T.doPass(a, 3); T.doPass(a, 0);
ok(a.done && a.result === "redeal", "four passes = redeal");
a = T.auction(0); T.doPass(a, 1); T.doPass(a, 2); T.doPass(a, 3);
ok(!T.canPass(a, 0, {mustCall:true}) && T.canPass(a, 0, {}), "mustCall stops the dealer passing");
a = T.auction(0); T.doPass(a, 1); T.doPass(a, 2); T.doPass(a, 3); ok(T.doCall(a, 0, {n:1, s:"C"}) && a.done && a.result === "won", "dealer calls after three passes");

// legal cards and trick winners
const h = ["5S", "9H", "2H"];
ok(T.legal(h, [{seat:0, c:"12H"}]).length === 2, "must follow hearts");
ok(T.legal(h, [{seat:0, c:"12D"}]).length === 3, "no diamonds: anything");
const tr = [{seat:0, c:"12H"}, {seat:1, c:"14H"}, {seat:2, c:"2S"}, {seat:3, c:"14D"}];
ok(T.trickWinner(tr, "S") === 2 && T.trickWinner(tr, "C") === 1, "trump wins, else highest of the led suit");
ok(T.trickWinner([{seat:0, c:"3H"}, {seat:1, c:"14D"}, {seat:2, c:"2S"}, {seat:3, c:"9S"}], "S") === 3, "highest trump wins");
const D = T.deck(); ok(D.length === 52 && new Set(D).size === 52, "deck");
ok(T.weakHand(["10S", "9H", "2D"]) && !T.weakHand(["11S", "9H"]), "weak hand: nothing above a 10");

// full games through the referee with random bots: every card played once, scores add up, secrets stay secret
let hands = 0, redeals = 0, weaks = 0, doubled = 0, all13 = 0, games = 0;
const cfgs = [{target:31, weak:true, dbl:true, mustCall:false, defenders:false}, {target:41, weak:false, dbl:false, mustCall:true, defenders:true}];
for(let gi = 0; gi < 400; gi++){
  const cfg = cfgs[gi % 2], g = T.Game(cfg, ["A", "B", "C", "D"], ["pa", "pb", "pc", "pd"]); g.start(); let guard = 0, handStartV = 0;
  while(g.phase !== "over"){
    if(++guard > 30000) throw new Error("game never ended");
    const p = T.pub(g), pj = JSON.stringify(p);
    if(g.phase !== "redeal") for(let i = 0; i < 4; i++) for(const c of g.hands[i]) ok(!pj.includes('"' + c + '"'), "pub leaks a card in someone's hand");
    for(let i = 0; i < 4; i++){ const pr = T.priv(g, i); ok(pr.seat === i && pr.hand === g.hands[i], "priv is the player's own hand"); }
    if(g.phase === "redeal"){ redeals++; if(g.redealWhy === "weak") weaks++; g.advance(); continue; }
    if(g.phase === "trickdone" || g.phase === "handdone"){ if(g.phase === "handdone"){ hands++; const s = g.summary; if(s.doubled) doubled++; if(s.tricks[T.team(s.caller)] === 13) all13++;
        eq(s.totals, g.scores, "totals"); ok(s.pts.every(Number.isInteger), "integer points"); ok(s.tricks[0] + s.tricks[1] === 13, "13 tricks"); } g.advance(); continue; }
    if(g.phase === "auction"){
      const au = g.au, r = Math.random(); let done = false;
      for(let i = 0; i < 4 && !done; i++){ const pr = T.priv(g, i); if(pr.act.canDouble && Math.random() < 0.05){ done = g.act(i, {k:"double"}).ok; ok(done, "double accepted"); ok(g.phase === "play", "double ends the auction"); } }
      if(done) continue;
      for(let i = 0; i < 4; i++){ const pr = T.priv(g, i); if(pr.act.canWeak && Math.random() < 0.5){ ok(g.act(i, {k:"weak"}).ok, "weak accepted"); done = true; break; } }
      if(done) continue;
      const seat = au.turn;
      ok(!g.act((seat + 1) % 4, {k:"pass"}).ok, "can't pass out of turn");
      if(r < 0.5){ const base = au.high ? T.callValue(au.high.call) + 1 : 0; if(base <= 27){ const v = base + Math.floor(Math.random() * Math.min(5, 28 - base)); if(g.act(seat, {k:"bid", n:Math.floor(v / 4) + 1, s:T.SUITS[v % 4]}).ok) continue; } }
      if(!g.act(seat, {k:"pass"}).ok) ok(g.act(seat, {k:"bid", n:7, s:"S"}).ok || g.act(seat, {k:"bid", n:1, s:"C"}).ok, "forced call");
      continue; }
    if(g.phase === "play"){
      const seat = g.turn, pr = T.priv(g, seat); ok(pr.act.k === "play" && pr.act.legal.length > 0, "play act"); for(let i = 0; i < 4; i++) if(i !== seat) ok(T.priv(g, i).act === null, "only the player to move may play");
      const bad = g.hands[seat].find(c => !pr.act.legal.includes(c)); if(bad) ok(!g.act(seat, {k:"play", c:bad}).ok, "illegal card refused");
      ok(!g.act((seat + 1) % 4, {k:"play", c:g.hands[(seat + 1) % 4][0]}).ok, "out of turn refused");
      ok(g.act(seat, {k:"play", c:pr.act.legal[Math.floor(Math.random() * pr.act.legal.length)]}).ok, "legal card accepted"); continue; }
    throw new Error("stuck in " + g.phase);
  }
  games++; ok(T.winner(g.scores, cfg.target) !== -1, "a game ends only with a winner");
}
console.log(`tarneeb rules: ${n} checks passed; ${games} games, ${hands} hands (${redeals} redeals of which ${weaks} weak-hand, ${doubled} doubled, ${all13} all-13 hands)`);
