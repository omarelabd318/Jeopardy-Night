// 6.100: tests the Liar's Bar rules in src/liars.js (the "rules" region, no screen code). Run: node v4work/tools/liars-test.js
const fs = require("fs"), path = require("path"), assert = require("assert");
const src = fs.readFileSync(path.join(__dirname, "../../src/liars.js"), "utf8");
const m = src.match(/\/\*@rules\*\/([\s\S]*?)\/\*@end-rules\*\//); if(!m) throw new Error("rules region not found");
const L = new Function(m[1] + "; return LBR;")();
let n = 0; const ok = (c, msg) => { n++; assert(c, msg); }, eq = (a, b, msg) => { n++; assert.deepStrictEqual(a, b, msg); };
const names = k => Array.from({length:k}, (_, i) => ({p:"p" + i, n:"P" + i}));
// a seeded random so a failure can be replayed
const seeded = s => () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;

// decks: 4 players = 6 of each rank and 2 Jokers; always enough for 5 cards each
for(let k = 3; k <= 8; k++){ const d = L.deckFor(k); ok(d.length >= 5 * k, "deck big enough for " + k); }
eq(L.deckFor(4).filter(c => c === "K").length, 6, "4 players: 6 kings"); eq(L.deckFor(4).filter(c => c === "J").length, 2, "4 players: 2 jokers");
eq(L.Game(names(2)), null, "needs 3"); eq(L.Game(names(9)), null, "at most 8");

// deal: 5 cards each, hidden info separate, table card is one of K Q A
{ const g = L.Game(names(5), seeded(1)); g.start();
  ok(g.seats.every(s => s.hand.length === 5), "5 cards each"); ok(["K", "Q", "A"].includes(g.tbl), "table card");
  ok(g.pub().seats.every(s => s.c === 5 && !("hand" in s)), "pub has counts only"); ok(JSON.stringify(g.pub()).indexOf('"hand"') < 0, "pub has no hands");
  eq(Object.keys(g.priv("p0")), ["hand"], "priv is the hand"); }

// a play: 1 to 3 cards, only on your turn, hand shrinks, turn passes, first play can't be called
{ const g = L.Game(names(4), seeded(2)); g.start(); const t = g.seats[g.turn].p, o = g.seats[(g.turn + 1) % 4].p;
  ok(!g.call(t), "can't call the first play"); ok(!g.play(o, [0]), "not your turn"); ok(!g.play(t, []), "0 cards"); ok(!g.play(t, [0, 1, 2, 3]), "4 cards"); ok(!g.play(t, [0, 0]), "same card twice"); ok(!g.play(t, [9]), "no such card");
  ok(g.play(t, [0, 1]), "plays 2"); eq(g.seats.find(s => s.p === t).hand.length, 3, "hand shrank"); eq(g.pile, 2, "pile counts"); eq(g.seats[g.turn].p, o, "turn passes");
  ok(!g.call(t), "only the next player can call"); ok(g.call(o), "the next player calls"); eq(g.phase, "reveal", "flip"); ok(!g.play(o, [0]), "no play during the reveal"); }

// challenge: lying loses, truth makes the caller lose; jokers are wild
{ const g = L.Game(names(4), seeded(3)); g.start(); g.tbl = "Q"; const a = g.turn, b = (a + 1) % 4;
  g.seats[a].hand = ["Q", "J", "K", "A", "A"]; g.play(g.seats[a].p, [0, 1]); g.call(g.seats[b].p);
  eq(g.rev.liar, false, "queen + joker is the truth"); eq(g.rev.loser, b, "the caller was wrong"); }
{ const g = L.Game(names(4), seeded(4)); g.start(); g.tbl = "Q"; const a = g.turn, b = (a + 1) % 4;
  g.seats[a].hand = ["Q", "J", "K", "A", "A"]; g.play(g.seats[a].p, [0, 2]); g.call(g.seats[b].p);
  eq(g.rev.liar, true, "a king is a lie"); eq(g.rev.loser, a, "the liar loses"); eq(g.rev.claimer, a, "claimer"); }

// the cylinder: odds 1 in 6, 1 in 5 ... and the bust lands exactly once, never later than the 6th spin
for(let seed = 1; seed <= 60; seed++){ const g = L.Game(names(3), seeded(seed)); g.start(); const s = g.seats[0]; s.bust = seed % 6; let out = false;
  for(let k = 1; k <= 6 && !out; k++){ g.phase = "reveal"; g.rev = {loser:0, cards:[], liar:true, claimer:0, caller:1}; g.spin(); eq(g.res.odds, 7 - k, "odds"); eq(g.res.k, k, "spin number");
    out = g.res.bust; eq(out, s.out, "bust means out"); if(!out){ g.phase = "spin"; } }
  ok(out && s.spins === (seed % 6) + 1, "busts on the chamber it was given"); eq(g.order, ["p0"], "bust order"); }

// empty hands: skipped; when every other player is empty only Liar! is allowed, so the round must end in a challenge
{ const g = L.Game(names(3), seeded(5)); g.start(); const a = g.turn, b = (a + 1) % 3, c = (a + 2) % 3; g.tbl = "K";
  g.seats[a].hand = ["K", "K", "K", "K", "K"]; g.seats[b].hand = ["K"]; g.seats[c].hand = ["K"];
  g.play(g.seats[a].p, [0]); eq(g.turn, b, "b next"); g.play(g.seats[b].p, [0]); eq(g.seats[b].hand.length, 0, "b is empty"); eq(g.turn, c, "c next");
  g.play(g.seats[c].p, [0]); eq(g.turn, a, "b and c are empty, so back to a (b and c are skipped)"); ok(g.liarOnly(), "a can only call"); ok(!g.play(g.seats[a].p, [0]), "a can't play on");
  ok(g.pub().lo, "pub says liar only"); ok(g.call(g.seats[a].p), "a calls Liar on c"); eq(g.rev.claimer, c, "against c"); }
// a player who played their last cards can be called by the next player who still has cards
{ const g = L.Game(names(4), seeded(6)); g.start(); const a = g.turn; g.seats[a].hand = ["Q"]; g.tbl = "Q"; g.play(g.seats[a].p, [0]); eq(g.seats[a].hand.length, 0, "empty"); eq(g.turn, (a + 1) % 4, "next with cards"); ok(g.call(g.seats[g.turn].p), "can call an emptied hand"); }

// timeout plays one random card, or calls when that's the only move
{ const g = L.Game(names(4), seeded(7)); g.start(); const t = g.turn; ok(g.auto(), "auto plays"); eq(g.seats[t].hand.length, 4, "one card played"); eq(g.last.n, 1, "claim of one"); }
{ const g = L.Game(names(3), seeded(8)); g.start(); const a = g.turn; g.seats.forEach((s, i) => { if(i !== a) s.hand = []; }); g.last = {by:(a + 1) % 3, cards:["K"], n:1}; ok(g.auto(), "auto calls"); eq(g.phase, "reveal", "when only Liar! is left"); }

// next round: loser starts if alive, else the next living player; busted players get no cards; last one standing wins
{ const g = L.Game(names(3), seeded(9)); g.start(); g.phase = "reveal"; g.rev = {loser:1, cards:[], liar:true, claimer:1, caller:2}; g.seats[1].bust = 0; g.spin(); eq(g.seats[1].out, true, "busted");
  ok(g.next(), "next"); eq(g.round, 2, "round 2"); eq(g.turn, 2, "the next living player starts"); eq(g.seats[1].hand.length, 0, "busted player has no cards"); ok(g.priv("p1").hand === undefined, "busted player gets no hand");
  g.phase = "reveal"; g.rev = {loser:2, cards:[], liar:true, claimer:2, caller:0}; g.seats[2].bust = g.seats[2].spins; g.spin(); g.next();
  eq(g.phase, "over", "over"); eq(g.winner, "p0", "p0 wins"); eq(g.order, ["p1", "p2"], "bust order"); }
// a survivor starts the next round
{ const g = L.Game(names(4), seeded(10)); g.start(); g.phase = "reveal"; g.rev = {loser:2, cards:[], liar:true, claimer:2, caller:3}; g.seats[2].bust = 5; g.spin(); g.next(); eq(g.turn, 2, "the loser starts"); }

// whole random games: always end, every round ends in a challenge, nobody is called on themselves, cards conserved
for(let seed = 1; seed <= 300; seed++){ const rnd = seeded(seed * 7 + 1), k = 3 + (seed % 6), g = L.Game(names(k), rnd); g.start(); let steps = 0;
  while(g.phase !== "over" && steps++ < 20000){
    if(g.phase === "turn"){ const s = g.seats[g.turn];
      ok(!s.out && s.hand.length > 0, "the player to move has cards"); if(g.last) ok(g.turn !== g.last.by, "never called on yourself");
      const lo = g.liarOnly(), r = rnd();
      if(g.last && (lo || r < 0.35)) ok(g.call(s.p), "call"); else { ok(!lo, "not liar only"); const cnt = 1 + Math.floor(rnd() * Math.min(3, s.hand.length)), ix = []; while(ix.length < cnt){ const q = Math.floor(rnd() * s.hand.length); if(!ix.includes(q)) ix.push(q); } ok(g.play(s.p, ix), "play"); } }
    else if(g.phase === "reveal") ok(g.spin(), "spin"); else ok(g.next(), "next"); }
  ok(g.phase === "over", "game " + seed + " ended"); eq(g.order.length, k - 1, "everyone else busted"); ok(g.seats.filter(s => !s.out).length === 1, "one left"); }
console.log("ok: " + n + " checks");
