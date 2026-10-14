// 7.4: tests the 3-5-8 rules and referee in src/threefive.js (the "rules" region, no screen code). Run: node v4work/tools/threefive-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/threefive.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//);
if(!m) throw new Error("rules region not found");
const T = new Function(m[1] + "; return TFR;")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };

// roles and targets: 3 players, the button deals and needs 8; the player after leads and needs 5
let r = T.roles(3, 0); eq(r, {eldest:1, middle:2, dealer:0, rest:-1}, "3 players roles");
eq(T.targetsFor("853", r), {1:5, 2:3, 0:8}, "853 targets");
eq(T.targetsFor("952", r), {1:5, 2:2, 0:9}, "952 targets");
r = T.roles(4, 1); eq(r, {eldest:2, middle:3, dealer:0, rest:1}, "4 players: the button sits out, the last of the other three deals");
ok([r.eldest, r.middle, r.dealer, r.rest].sort().join() === "0,1,2,3", "4 roles cover everyone");

// trick winner: highest of the led suit, or the highest trump; no trump = null
const tr = (...cs) => cs.map((c, i) => ({seat:i, c}));
ok(T.trickWinner(tr("10S", "14S", "2S"), "H") === 1, "ace of the led suit");
ok(T.trickWinner(tr("10S", "14S", "2H"), "H") === 2, "a low trump beats the ace");
ok(T.trickWinner(tr("10S", "14H", "13D"), null) === 0, "no trump: the led suit wins");
ok(T.trickWinner(tr("10S", "3H", "4H"), "H") === 2, "higher trump");
ok(T.trickWinner(tr("10S", "3H", "4C"), "D") === 0, "off-suit never wins");
// follow suit
eq(T.legal(["3S", "5H", "9S"], [{seat:0, c:"2S"}]), ["3S", "9S"], "must follow");
eq(T.legal(["3S", "5H"], [{seat:0, c:"2D"}]), ["3S", "5H"], "void: anything");
eq(T.legal(["3S", "5H"], []), ["3S", "5H"], "leading: anything");

// swap plan: one up two down, two up one down, caps, inactive players skipped
eq(T.swapPlan({d:{0:2, 1:-1, 2:-1}, t:{0:8, 1:5, 2:3}}, [0, 1, 2], 0), [{from:0, to:1, n:1}, {from:0, to:2, n:1}], "one up gives each down player their shortfall");
eq(T.swapPlan({d:{0:1, 1:1, 2:-2}, t:{0:5, 1:3, 2:8}}, [0, 1, 2], 0), [{from:0, to:2, n:1}, {from:1, to:2, n:1}], "higher target goes first");
eq(T.swapPlan({d:{0:3, 1:-3, 2:0}, t:{0:8, 1:5, 2:3}}, [0, 1, 2], 2), [{from:0, to:1, n:2}], "capped");
eq(T.swapPlan({d:{0:0, 1:0, 2:0}, t:{0:8, 1:5, 2:3}}, [0, 1, 2], 0), [], "all on target: no swap");
eq(T.swapPlan({d:{0:2, 1:-1, 2:-1}, t:{0:8, 1:5, 2:3}}, [0, 1, 3], 0), [{from:0, to:1, n:1}], "a player who rests this hand is skipped");

// exchange: the receiver sends back their highest card of that suit if it is higher, otherwise the same card
let e = T.exchange(["3H", "9S"], ["14H", "5H", "2C"], ["3H"]);
eq(e.back, ["14H"], "the highest heart comes back"); eq(e.giver, T.sortHand(["14H", "9S"]), "giver hand"); eq(e.receiver, T.sortHand(["5H", "3H", "2C"]), "receiver hand");
e = T.exchange(["13H", "9S"], ["5H", "2C"], ["13H"]); eq(e.back, ["13H"], "nothing higher: the same card comes back"); eq(e.receiver, T.sortHand(["5H", "2C"]), "receiver unchanged");
e = T.exchange(["13D"], ["5H", "2C"], ["13D"]); eq(e.back, ["13D"], "no card of that suit: the same card comes back");
e = T.exchange(["2H", "3H"], ["14H", "13H", "5H"], ["2H", "3H"]); eq(e.back, ["14H", "13H"], "two cards, each gets the next highest"); eq(e.giver.length, 2, "hand size kept");

// a whole referee game with random legal moves: deck conservation, 16 tricks, scores add to zero, every hand ends
const rnd = () => Math.random();
function play(n, cfg){
  const names = Array.from({length:n}, (_, i) => "P" + i), g = T.Game(cfg, names, names.map(x => "p" + x)); g.start();
  let guard = 0;
  while(g.phase !== "over" && guard++ < 5000){
    const total = g.hands.reduce((s, h) => s + h.length, 0) + g.trick.length + g.won.reduce((s, x) => s + x * 3, 0) + (g.phase === "bury" || g.phase === "trump" || g.phase === "swap" ? g.kitty.length : 0);
    if(g.phase === "swap" || g.phase === "trump" || g.phase === "bury") ok(g.hands.reduce((s, h) => s + h.length, 0) === 48, "48 cards in hands before play");
    if(g.phase === "swap"){ const st = g.swap.list[g.swap.i], h = g.hands[st.from], cs = T.shuffle(h.slice()).slice(0, st.n); ok(g.act(st.from, {k:"give", cs}).ok, "give"); }
    else if(g.phase === "trump"){ ok(!g.act((g.turn + 1) % n, {k:"trump", s:"H"}).ok, "only the dealer names trump"); ok(g.act(g.turn, {k:"trump", s:T.SUITS[Math.floor(rnd() * 4)]}).ok, "trump"); }
    else if(g.phase === "bury"){ const h = g.hands[g.turn]; ok(h.length === 16, "dealer buries from 16"); ok(!g.act(g.turn, {k:"bury", cs:h.slice(0, 3)}).ok, "must bury exactly 4"); const cs = T.shuffle(h.slice()).slice(0, 4); ok(g.act(g.turn, {k:"bury", cs}).ok, "bury"); ok(g.hands[g.roles.dealer].length === 16, "16 after the kitty"); }
    else if(g.phase === "play"){ const h = g.hands[g.turn], l = T.legal(h, g.trick), c = l[Math.floor(rnd() * l.length)]; const bad = h.find(x => !l.includes(x)); if(bad) ok(!g.act(g.turn, {k:"play", c:bad}).ok, "illegal card refused"); ok(g.act(g.turn, {k:"play", c}).ok, "play"); }
    else if(g.phase === "trickdone" || g.phase === "handdone"){
      if(g.phase === "handdone"){ const s = g.summary; ok(s.rows.length === 3, "three players scored"); ok(s.rows.reduce((a, x) => a + x.tricks, 0) === 16, "16 tricks"); ok(s.rows.reduce((a, x) => a + x.d, 0) === 0, "scores add to zero"); ok(g.scores.reduce((a, x) => a + x, 0) === 0, "totals add to zero"); if(n === 4) ok(s.rest >= 0 && !s.rows.some(x => x.seat === s.rest), "the rester doesn't score"); }
      ok(g.advance(), "advance"); }
    else throw new Error("stuck in " + g.phase);
  }
  ok(g.phase === "over", "game ends"); ok(g.winners.length >= 1, "has a winner");
  const top = Math.max(...g.scores); ok(g.winners.every(i => g.scores[i] === top), "winners have the top score");
  if(cfg.len !== "t") ok(g.hand >= cfg.len * n, "played the full length");
  else ok(top >= 10, "first to +10");
  return g; }
for(let i = 0; i < 300; i++){ play(3, {targets:"853", nt:false, swapMax:0, len:1}); play(3, {targets:"952", nt:true, swapMax:3, len:2}); play(4, {targets:"853", nt:false, swapMax:0, len:1}); play(4, {targets:"952", nt:false, swapMax:3, len:1}); }
for(let i = 0; i < 30; i++) play(3, {targets:"853", nt:true, swapMax:0, len:"t"});

// privacy: priv has only the player's own hand; pub has no hands
{ const g = T.Game({targets:"853", nt:false, swapMax:0, len:1}, ["A", "B", "C"], ["a", "b", "c"]); g.start();
  const pub = JSON.stringify(T.pub(g)); ok(!/"hands"|"kitty"/.test(pub), "pub has no hands or kitty");
  const p0 = T.priv(g, 0); ok(p0.hand.length === 16 && !("hands" in p0), "priv is one hand");
  ok(T.priv(g, g.turn).act && T.priv(g, g.turn).act.k === "trump", "the dealer is asked for trump first"); ok([0, 1, 2].filter(i => T.priv(g, i).act).length === 1, "only one player has a move"); }
// the first hand has no swap; the second has one if anyone was over or under
{ const g = T.Game({targets:"853", nt:false, swapMax:0, len:2}, ["A", "B", "C"], ["a", "b", "c"]); g.start(); ok(g.phase === "trump", "no swap in hand 1"); }
// ties: a tie after the last hand gets one extra hand, then the leaders share
{ const g = T.Game({targets:"853", nt:false, swapMax:0, len:1}, ["A", "B", "C"], ["a", "b", "c"]); g.start(); g.hand = 3; g.scores = [2, 2, -4]; g.phase = "handdone"; g.summary = {rows:[]};
  g.advance(); ok(g.phase !== "over" && g.tieHand && g.total === 4, "tie gives one extra hand"); g.phase = "handdone"; g.hand = 4; g.advance(); ok(g.phase === "over" && g.winners.join() === "0,1", "still tied: shared"); }
console.log("OK", n, "checks");
