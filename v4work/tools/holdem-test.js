// 7.1: tests the Texas Hold'em hand ranking, side pots and referee in src/holdem.js (the "rules" region, no screen code). Run: node v4work/tools/holdem-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/holdem.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//);
if(!m) throw new Error("rules region not found");
const H = new Function(m[1] + "; return HE;")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };
const B = cs => H.best(cs.split(" "));   // "14S 13S ..." card codes
const rank = (a, b) => H.cmp(B(a).s, B(b).s);

// hand names and ordering
eq(B("14S 13S 12S 11S 10S 2D 3C").name, "Royal flush", "royal");
eq(B("9H 8H 7H 6H 5H 14D 2C").name, "Straight flush, Nine high", "straight flush");
eq(B("14H 2H 3H 4H 5H 9D 9C").name, "Straight flush, Five high", "steel wheel is a five-high straight flush");
eq(B("7C 7D 7H 7S 13D 2C 3H").name, "Four of a kind, Sevens", "quads");
eq(B("13S 13H 13D 4C 4S 2C 9H").name, "Full house, Kings full of Fours", "full house");
eq(B("13S 13H 13D 4C 4S 4D 9H").name, "Full house, Kings full of Fours", "two trips: the lower becomes the pair");
eq(B("14D 11D 8D 5D 2D 13S 13H").name, "Flush, Ace high", "flush beats the pair on the board");
eq(B("10C 9D 8S 7H 6C 2C 2D").name, "Straight, Ten high", "straight");
eq(B("14C 2D 3S 4H 5C 9C 13D").name, "Straight, Five high", "wheel");
eq(B("12C 12H 12S 9D 3C 5H 7D").name, "Three of a kind, Queens", "trips");
eq(B("11H 11C 5D 5S 14H 3C 2D").name, "Two pair, Jacks and Fives", "two pair");
eq(B("11H 11C 5D 5S 14H 9C 9D").name, "Two pair, Jacks and Nines", "three pair: the best two");
eq(B("10S 10H 13C 7D 2S 4C 9H").name, "Pair of Tens", "pair");
eq(B("14C 12D 9S 6H 3C 2D 7H").name, "High card, Ace", "high card");
ok(rank("14S 14H 2C 5D 9H 11C 3S", "13S 13H 2C 5D 9H 11C 3S") > 0, "aces beat kings");
ok(rank("14S 14H 13C 5D 9H 11C 3S", "14D 14C 12C 5D 9H 11C 3S") > 0, "kicker decides");
ok(rank("14S 14H 13C 13D 9H 11C 3S", "14D 14C 12C 12D 9H 11C 3S") > 0, "two pair: higher second pair");
ok(rank("14S 13S 12S 11S 9S 2D 3C", "14D 13D 12D 11D 8D 2C 3H") > 0, "flush: the fifth card decides");
ok(rank("6S 5H 4D 3C 2S 9H 13C", "5S 4H 3D 2C 14S 9H 13C") > 0, "six-high straight beats the wheel");
ok(rank("9S 9H 9D 2C 2S 5H 7C", "8S 8H 8D 14C 14S 5H 7C") > 0, "full house: the trips decide first");
eq(rank("14S 14H 13C 12D 9H 5C 3S", "14D 14C 13H 12S 9C 5H 3D"), 0, "same hand, different suits tie");
eq(B("14S 14H 13C 12D 9H 5C 3S").cards.length, 5, "best five");
eq(H.preflop(["14S", "13S"]), "A K suited", "preflop name"); eq(H.preflop(["13S", "13H"]), "Pocket Kings", "pocket pair"); eq(H.preflop(["2S", "10H"]), "10 2 offsuit", "offsuit");

// blinds
eq(H.blindsFor(0), [10, 20], "level 1"); eq(H.blindsFor(8), [300, 600], "level 9"); eq(H.blindsFor(9), [600, 1200], "level 10 doubles"); eq(H.blindsFor(11), [2400, 4800], "level 12");

// side pots: the example from the framework doc, Omar all in for 200, Sara and Karim 500 each
let sp = H.sidePots([200, 500, 500], [false, false, false]);
eq(sp, [{amt:600, elig:[0, 1, 2]}, {amt:600, elig:[1, 2]}], "main 600 and side 600");
sp = H.sidePots([100, 300, 300, 50], [false, false, false, true]);   // seat 3 folded after putting in 50
eq(sp.map(p => p.amt), [350, 400], "folded money stays in the pots"); eq(sp[0].elig, [0, 1, 2], "folded seat can't win");
sp = H.sidePots([60, 100], [false, false]); eq(sp, [{amt:120, elig:[0, 1]}, {amt:40, elig:[1]}], "an uncalled bet comes back to its owner");
sp = H.sidePots([50, 100, 100, 100], [false, true, false, true]); eq(sp.map(p => p.amt), [200, 150], "folded players put more in than the all-in");

// scripted hands through the referee. rig(g, hole, board) stacks the deck so the cards are known
const cfg = {chips:1000, up:8, end:"last", fixed:30, timer:30, helper:true, four:false};
const rig = (g, holes, board) => { for(let i = 0; i < holes.length; i++) g.hole[i] = holes[i].split(" "); g.deck = board.split(" ").reverse(); };
const total = g => g.stack.reduce((s, x) => s + x, 0) + (g.phase === "hand" || g.phase === "run" ? g.tot.reduce((s, x) => s + x, 0) : 0);   // after the hand the pots are paid, tot is only kept for showing them
const mk = (nm, rnd) => { const g = H.Game(Object.assign({}, cfg), nm, nm.map((_, i) => "p" + i), rnd || (() => 0.0)); g.start(); return g; };

// heads-up: the button posts the small blind and acts first before the flop; the other acts first after
let g = mk(["A", "B"]); ok(g.sb === g.dealer && g.turn === g.dealer, "heads-up: button is SB and acts first"); eq(g.bet[g.sb], 10, "SB 10"); eq(g.bet[g.bb], 20, "BB 20");
const bb = g.bb, sb = g.sb; g.hole[sb] = ["14S", "14H"]; g.hole[bb] = ["13S", "13H"]; g.deck = ["2C", "7D", "9H", "4S", "11C"].reverse();
ok(g.act(sb, {k:"call"}).ok && g.turn === bb && g.phase === "hand", "SB calls, BB has the option");
ok(!g.act(sb, {k:"check"}).ok, "out of turn refused"); ok(g.act(bb, {k:"check"}).ok && g.street === 1 && g.board.length === 3, "BB checks, flop");
ok(g.turn === bb, "heads-up: the non-button acts first after the flop");
ok(g.act(bb, {k:"check"}).ok && g.act(sb, {k:"check"}).ok && g.board.length === 4, "turn"); ok(g.act(bb, {k:"check"}).ok && g.act(sb, {k:"check"}).ok && g.board.length === 5, "river");
ok(g.act(bb, {k:"check"}).ok && g.act(sb, {k:"check"}).ok && g.phase === "show", "showdown"); eq(g.stack[sb], 1020, "aces win the 40"); eq(g.stack[bb], 980, "kings lose their 20"); eq(g.show.pots[0].name, "Pair of Aces", "named");
eq(total(g), 2000, "chips are conserved");

// three players: all in, side pot, a short stack wins the main pot only
g = mk(["A", "B", "C"]); g.stack = [0, 0, 0]; g.hn = 0;
g = H.Game(Object.assign({}, cfg, {chips:1000}), ["A", "B", "C"], ["a", "b", "c"], () => 0); g.stack = [200, 1000, 1000]; g.start();
const d = g.dealer, s1 = (d + 1) % 3, s2 = (d + 2) % 3;   // dealer, SB, BB; first to act is the dealer in 3-handed
ok(g.turn === d, "3-handed: the player after the BB (the button) acts first");
rig(g, ["2C 3D", "2C 3D", "2C 3D"], "5S 6S 9H 12D 13C");
g.hole[0] = ["14S", "14H"]; g.hole[1] = ["13S", "13H"]; g.hole[2] = ["12S", "12H"]; g.board = [];
g.deck = ["2D", "3H", "4C", "9D", "10H", "8C", "7S"].reverse(); g.deck = g.deck;   // flop 7S 8C 10H then 9D, 4C: no help to anyone; seat 0's aces win
function allIn(g){ let guard = 0; while(g.phase === "hand" && guard++ < 20){ const i = g.turn, pr = H.priv(g, i).act; if(pr.canRaise && pr.maxTo > g.cur) ok(g.act(i, {k:"allin"}).ok, "shove"); else ok(g.act(i, pr.toCall > 0 ? {k:"call"} : {k:"check"}).ok, "call"); } }
g.deck = ["2D", "3H", "4C", "9D", "10H", "8C", "7S"].reverse();
allIn(g); ok(g.phase === "run" || g.phase === "show", "everyone all in: the board runs out"); while(g.phase === "run") g.advance();
ok(g.phase === "show", "showdown after the run out"); eq(total(g), 2200, "chips conserved with side pots");
eq(g.show.pots.length, 2, "main pot and a side pot"); eq(g.show.pots[0].amt, 600, "main pot 3 x 200"); eq(g.show.pots[1].amt, 1600, "side pot 800 x 2");
ok(g.show.pots[0].win[0] === 0 && g.show.pots[1].win[0] === 1, "aces win the main pot, kings the side pot");
eq(g.stack[0], 600, "short stack wins only the main pot"); eq(g.stack[1], 1600, "kings win the side pot"); eq(g.stack[2], 0, "queens lose everything"); eq(g.out[2], 3, "queens are out in 3rd");

// everyone else folds: the winner takes the pot without a showdown and shows nothing
g = mk(["A", "B", "C"]); const t0 = g.turn; ok(g.act(t0, {k:"fold"}).ok, "fold"); ok(g.act(g.turn, {k:"fold"}).ok && g.phase === "show", "last player wins uncontested");
ok(g.show.unc != null && Object.keys(g.show.hands).length === 0, "no cards shown"); eq(total(g), 3000, "conserved");
ok(H.priv(g, g.show.unc).canShow && g.act(g.show.unc, {k:"showcards"}).ok && H.pub(g).faceUp[g.show.unc], "the winner can show");
ok(!H.priv(g, (g.show.unc + 1) % 3).canShow, "others can't");

// minimum raise rules and a short all-in that does not reopen the betting
g = H.Game(Object.assign({}, cfg), ["A", "B", "C"], ["a", "b", "c"], () => 0); g.stack = [1000, 1000, 70]; g.start();
let first = g.turn; let pr = H.priv(g, first).act;
ok(pr.canRaise && pr.minTo === 40 && !pr.canCheck && pr.toCall === 20, "min raise to 40 (BB 20 + 20)");
ok(!g.act(first, {k:"raise", to:30}).ok && !g.act(first, {k:"raise", to:25}).ok, "raise below the minimum refused"); ok(!g.act(first, {k:"raise", to:5000}).ok, "raise above the stack refused");
ok(g.act(first, {k:"raise", to:100}).ok, "raise to 100"); eq(g.minRaise, 80, "the next raise must be at least 80 more");
let nx = g.turn; pr = H.priv(g, nx).act; eq(pr.minTo, 180, "min re-raise is to 180");
// the player with 70 total goes all in short of a raise
const shortSeat = [0, 1, 2].find(i => g.stack[i] + g.bet[i] === 70 || (i === 2 && g.stack[2] + g.bet[2] <= 70));
g = H.Game(Object.assign({}, cfg), ["A", "B", "C"], ["a", "b", "c"], () => 0); g.stack = [1000, 1000, 1000]; g.start();
const a1 = g.turn; ok(g.act(a1, {k:"call"}).ok, "call"); const a2 = g.turn; ok(g.act(a2, {k:"call"}).ok, "SB completes"); const a3 = g.turn; ok(g.act(a3, {k:"check"}).ok && g.street === 1, "flop");
// on the flop: first bets 100, the next has only 130 left (raise 30 < 100: short all-in)
const f1 = g.turn, f2 = (f1 + 1) % 3; g.stack[f2] = 130; ok(g.act(f1, {k:"raise", to:100}).ok, "bet 100");
while(g.turn !== f2) g.act(g.turn, {k:"fold"}); ok(g.turn === f2 || g.phase === "show", "to the short stack");
if(g.phase === "hand"){ const before = g.minRaise; ok(g.act(f2, {k:"allin"}).ok, "short all-in raise to 130"); eq(g.cur, 130, "current bet is 130"); eq(g.minRaise, before, "a short raise leaves the minimum alone");
  if(g.phase === "hand" && g.turn !== f1) g.act(g.turn, {k:"fold"});   // the third player folds
  if(g.phase === "hand"){ ok(g.turn === f1 && !H.priv(g, f1).act.canRaise && H.priv(g, f1).act.toCall === 30, "the original bettor may only call or fold (betting not reopened)"); ok(!g.act(f1, {k:"raise", to:400}).ok, "re-raise refused"); } }

// random games: every legal move set is accepted, chips never appear or vanish, games end, secrets stay secret
function bot(g, risk){ const i = g.turn, pr = H.priv(g, i).act, r = Math.random(); let a;
  if(pr.canRaise && r < risk){ const to = r < risk / 4 ? pr.maxTo : Math.min(pr.maxTo, pr.minTo + Math.floor(Math.random() * 3) * pr.bb); a = to === pr.maxTo && Math.random() < .5 ? {k:"allin"} : {k:"raise", to}; }
  else if(pr.canCheck) a = {k:"check"}; else a = Math.random() < .25 ? {k:"fold"} : {k:"call"};
  return g.act(i, a); }
let games = 0, hands = 0, showdowns = 0, unc = 0, runs = 0, splits = 0, finals = 0, fixeds = 0; const cfgs = [Object.assign({}, cfg), Object.assign({}, cfg, {chips:500, up:5}), Object.assign({}, cfg, {chips:2000, up:12, end:"fixed", fixed:20, timer:0})];
for(let gi = 0; gi < 600; gi++){
  const np = 2 + gi % 8, nm = Array.from({length:np}, (_, i) => "P" + i), c = cfgs[gi % 3], g = H.Game(Object.assign({}, c), nm, nm.map((_, i) => "p" + i)); g.start(); const all = np * c.chips; let guard = 0;
  while(g.phase !== "over"){
    if(++guard > 40000) throw new Error("game never ended");
    ok(total(g) === all, "chips conserved"); ok(g.stack.every(x => x >= 0), "no negative stacks");
    const p = H.pub(g), pj = JSON.stringify(p);
    if(g.phase === "hand") for(let i = 0; i < np; i++) for(const cd of g.hole[i]) ok(!pj.includes('"' + cd + '"'), "pub leaks a hole card during betting");
    for(let i = 0; i < np; i++){ const pv = H.priv(g, i); ok(pv.seat === i, "priv seat"); if(g.phase === "hand") ok((pv.act !== null) === (g.turn === i), "only the player to act has a move"); }
    if(g.phase === "show"){ hands++; if(g.show.unc != null) unc++; else showdowns++; ok(g.show.pots.reduce((s, x) => s + x.amt, 0) === g.tot.reduce((s, x) => s + x, 0), "pots add up to what went in"); if(g.show.pots.some(x => x.win.length > 1)) splits++;
      if(g.finalLeft == null && Math.random() < .004){ g.makeFinal(); finals++; } g.advance(); continue; }
    if(g.phase === "run"){ runs++; g.advance(); continue; }
    ok(g.turn >= 0 && g.turn < np && !g.folded[g.turn] && !g.allin[g.turn] && g.stack[g.turn] > 0, "the turn is a live player with chips");
    ok(!g.act((g.turn + 1) % np, {k:"fold"}).ok || np === 1, "out of turn refused");
    ok(bot(g, [.25, .5, .1][gi % 3]).ok, "a legal bot move is accepted");
  }
  games++; const rk = g.final; ok(rk.length === np && rk.some(x => x === 1), "someone is first"); if(c.end === "fixed") fixeds++;
  ok(g.stack.reduce((s, x) => s + x, 0) === all, "all chips accounted for at the end");
  if(c.end === "last" && g.finalLeft == null) ok(g.stack.filter(x => x > 0).length === 1, "last stack standing: one player has everything");
}
console.log(`holdem rules: ${n} checks passed; ${games} games, ${hands} hands (${showdowns} showdowns, ${unc} uncontested, ${runs} run-out streets, ${splits} with a split pot, ${finals} Final hands, ${fixeds} fixed-length games)`);
